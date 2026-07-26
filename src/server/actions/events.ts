"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { writeAudit } from "@/server/audit";
import { requireCapability } from "@/server/authz";
import { eventHasResults } from "@/server/guards";
import { fail, guardAction, ok, type ActionResult } from "./_result";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dato");

const eventSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    startDate: isoDate,
    endDate: isoDate,
    status: z.enum(["upcoming", "ongoing", "finished"]).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, { message: "Sluttdato før startdato." });

function parseEvent(formData: FormData) {
  return eventSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    status: formData.get("status") || undefined,
  });
}

/** Only admins create events (Events AC 2). */
export async function createEvent(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("events.create");
    const parsed = parseEvent(formData);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? nb.errors.invalidInput);

    await db.transaction(async (tx) => {
      const [row] = await tx.insert(events).values(parsed.data).returning({ id: events.id });
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "event.create",
        entityType: "Event",
        entityId: row.id,
        details: parsed.data,
      });
    });
    revalidatePath("/admin");
    return ok();
  });
}

/** Admins and secretaries edit event details (Events AC 2). */
export async function updateEvent(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("events.edit");
    const id = z.string().uuid().parse(formData.get("id"));
    const parsed = parseEvent(formData);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? nb.errors.invalidInput);

    await db.transaction(async (tx) => {
      await tx.update(events).set(parsed.data).where(eq(events.id, id));
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "event.update",
        entityType: "Event",
        entityId: id,
        details: parsed.data,
      });
    });
    revalidatePath("/admin");
    revalidatePath(`/admin/e/${id}`, "layout");
    return ok();
  });
}

/** Only admins delete events; blocked when any race has results (Events AC 6). */
export async function deleteEvent(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("events.create");
    const id = z.string().uuid().parse(formData.get("id"));

    if (await eventHasResults(id)) return fail(nb.errors.deleteBlockedResults);

    await db.transaction(async (tx) => {
      await tx.delete(events).where(eq(events.id, id));
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "event.delete",
        entityType: "Event",
        entityId: id,
      });
    });
    revalidatePath("/admin");
    return ok();
  });
}
