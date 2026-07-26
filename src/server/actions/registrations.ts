"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { qualifyingRuns, registrations, runScores } from "@/db/schema";
import { writeAudit } from "@/server/audit";
import { requireCapability } from "@/server/authz";
import { raceEventId } from "@/server/lookups";
import { fail, guardAction, ok, type ActionResult } from "./_result";

/**
 * Register a driver to a race (Events AC 4). Creates the registration plus its
 * two qualifying runs so scoring can begin (Qualifying AC 2).
 */
export async function registerDriver(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guardAction(async () => {
    const actor = await requireCapability("drivers.manage");
    const raceId = z.string().uuid().parse(formData.get("raceId"));
    const userId = z.string().uuid().parse(formData.get("userId"));

    await db.transaction(async (tx) => {
      const [reg] = await tx
        .insert(registrations)
        .values({ raceId, userId })
        .onConflictDoNothing()
        .returning({ id: registrations.id });
      // onConflictDoNothing → already registered; nothing more to do.
      if (!reg) return;
      await tx.insert(qualifyingRuns).values([
        { registrationId: reg.id, runNumber: 1 },
        { registrationId: reg.id, runNumber: 2 },
      ]);
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "registration.create",
        entityType: "Registration",
        entityId: reg.id,
        details: { raceId, userId },
      });
    });
    const eventId = await raceEventId(raceId);
    if (eventId) revalidatePath(`/admin/e/${eventId}/lop/${raceId}`, "layout");
    return ok();
  });
}

/** Unregister a driver — allowed only when that registration has no scores (Drivers AC 7). */
export async function unregisterDriver(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guardAction(async () => {
    const actor = await requireCapability("drivers.manage");
    const registrationId = z.string().uuid().parse(formData.get("registrationId"));
    const raceId = z.string().uuid().parse(formData.get("raceId"));

    const runRows = await db
      .select({ id: qualifyingRuns.id })
      .from(qualifyingRuns)
      .where(eq(qualifyingRuns.registrationId, registrationId));
    if (runRows.length > 0) {
      const scored = await db
        .select({ id: runScores.id })
        .from(runScores)
        .where(
          and(
            inArray(
              runScores.runId,
              runRows.map((r) => r.id),
            ),
            eq(runScores.confirmed, true),
          ),
        )
        .limit(1);
      if (scored.length > 0) return fail(nb.errors.deleteBlockedResults);
    }

    await db.transaction(async (tx) => {
      await tx.delete(registrations).where(eq(registrations.id, registrationId));
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "registration.delete",
        entityType: "Registration",
        entityId: registrationId,
      });
    });
    const eventId = await raceEventId(raceId);
    if (eventId) revalidatePath(`/admin/e/${eventId}/lop/${raceId}`, "layout");
    return ok();
  });
}
