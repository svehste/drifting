"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { raceOfficials, races, userRoles } from "@/db/schema";
import { writeAudit } from "@/server/audit";
import { requireCapability } from "@/server/authz";
import { raceHasResults } from "@/server/guards";
import { raceEventId } from "@/server/lookups";
import { fail, guardAction, ok, type ActionResult } from "./_result";

const raceSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  classId: z.string().uuid(),
  cupSize: z.enum(["4", "8", "16", "32"]),
  maxLine: z.coerce.number().int().min(1).max(200).default(40),
  maxAngle: z.coerce.number().int().min(1).max(200).default(30),
  maxStyleFlow: z.coerce.number().int().min(1).max(200).default(15),
  maxStyleEffort: z.coerce.number().int().min(1).max(200).default(15),
});

function parseRace(formData: FormData) {
  return raceSchema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    classId: formData.get("classId"),
    cupSize: formData.get("cupSize"),
    maxLine: formData.get("maxLine") ?? 40,
    maxAngle: formData.get("maxAngle") ?? 30,
    maxStyleFlow: formData.get("maxStyleFlow") ?? 15,
    maxStyleEffort: formData.get("maxStyleEffort") ?? 15,
  });
}

export async function createRace(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("races.manage");
    const parsed = parseRace(formData);
    if (!parsed.success) return fail(nb.errors.invalidInput);

    let newId = "";
    await db.transaction(async (tx) => {
      const [row] = await tx.insert(races).values(parsed.data).returning({ id: races.id });
      newId = row.id;
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "race.create",
        entityType: "Race",
        entityId: row.id,
        details: parsed.data,
      });
    });
    revalidatePath(`/admin/e/${parsed.data.eventId}`);
    return ok(newId);
  });
}

export async function updateRace(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("races.manage");
    const id = z.string().uuid().parse(formData.get("id"));
    const parsed = parseRace(formData);
    if (!parsed.success) return fail(nb.errors.invalidInput);

    await db.transaction(async (tx) => {
      await tx.update(races).set(parsed.data).where(eq(races.id, id));
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "race.update",
        entityType: "Race",
        entityId: id,
        details: parsed.data,
      });
    });
    revalidatePath(`/admin/e/${parsed.data.eventId}`);
    revalidatePath(`/admin/e/${parsed.data.eventId}/lop/${id}`, "layout");
    return ok();
  });
}

/** Delete a race; blocked when it has results (Races AC 8). */
export async function deleteRace(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("races.manage");
    const id = z.string().uuid().parse(formData.get("id"));
    const eventId = z.string().uuid().parse(formData.get("eventId"));

    if (await raceHasResults(id)) return fail(nb.errors.deleteBlockedResults);

    await db.transaction(async (tx) => {
      await tx.delete(races).where(eq(races.id, id));
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "race.delete",
        entityType: "Race",
        entityId: id,
      });
    });
    revalidatePath(`/admin/e/${eventId}`);
    return ok();
  });
}

async function userHasJudgeRole(userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "judge")))
    .limit(1);
  return rows.length > 0;
}

const criterionDuty = z.enum(["line", "angle", "style"]);

/**
 * Assign the single judge for a criterion (Races AC 6). Replaces any existing
 * judge for that (race, duty). The user must hold the judge role.
 */
export async function setCriterionJudge(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guardAction(async () => {
    const actor = await requireCapability("raceOfficials.assign");
    const raceId = z.string().uuid().parse(formData.get("raceId"));
    const duty = criterionDuty.parse(formData.get("duty"));
    const userId = z.string().uuid().parse(formData.get("userId"));

    if (!(await userHasJudgeRole(userId))) return fail("Valgt bruker er ikke dommer.");

    await db.transaction(async (tx) => {
      await tx
        .delete(raceOfficials)
        .where(and(eq(raceOfficials.raceId, raceId), eq(raceOfficials.duty, duty)));
      await tx.insert(raceOfficials).values({ raceId, userId, duty });
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "raceOfficial.setCriterionJudge",
        entityType: "RaceOfficial",
        entityId: raceId,
        details: { duty, userId },
      });
    });
    const eventId = await raceEventId(raceId);
    if (eventId) revalidatePath(`/admin/e/${eventId}/lop/${raceId}`, "layout");
    return ok();
  });
}

/** Add a battle judge (multiple allowed). */
export async function addBattleJudge(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guardAction(async () => {
    const actor = await requireCapability("raceOfficials.assign");
    const raceId = z.string().uuid().parse(formData.get("raceId"));
    const userId = z.string().uuid().parse(formData.get("userId"));
    if (!(await userHasJudgeRole(userId))) return fail("Valgt bruker er ikke dommer.");

    await db.transaction(async (tx) => {
      await tx.insert(raceOfficials).values({ raceId, userId, duty: "battle" }).onConflictDoNothing();
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "raceOfficial.addBattleJudge",
        entityType: "RaceOfficial",
        entityId: raceId,
        details: { userId },
      });
    });
    const eventId = await raceEventId(raceId);
    if (eventId) revalidatePath(`/admin/e/${eventId}/lop/${raceId}`, "layout");
    return ok();
  });
}

export async function removeOfficial(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guardAction(async () => {
    const actor = await requireCapability("raceOfficials.assign");
    const id = z.string().uuid().parse(formData.get("id"));
    const raceId = z.string().uuid().parse(formData.get("raceId"));

    await db.transaction(async (tx) => {
      await tx.delete(raceOfficials).where(eq(raceOfficials.id, id));
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "raceOfficial.remove",
        entityType: "RaceOfficial",
        entityId: id,
      });
    });
    const eventId = await raceEventId(raceId);
    if (eventId) revalidatePath(`/admin/e/${eventId}/lop/${raceId}`, "layout");
    return ok();
  });
}
