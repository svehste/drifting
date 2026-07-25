"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { classes, races } from "@/db/schema";
import { writeAudit } from "@/server/audit";
import { requireCapability } from "@/server/authz";
import { fail, guardAction, ok, type ActionResult } from "./_result";

const classSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.coerce.number().int().optional(),
});

/** Admins manage the shared class list (Races AC 9). */
export async function createClass(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("races.manage");
    const parsed = classSchema.safeParse({
      name: formData.get("name"),
      sortOrder: formData.get("sortOrder") || undefined,
    });
    if (!parsed.success) return fail(nb.errors.invalidInput);

    await db.transaction(async (tx) => {
      const [row] = await tx.insert(classes).values(parsed.data).returning({ id: classes.id });
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "class.create",
        entityType: "Class",
        entityId: row.id,
        details: parsed.data,
      });
    });
    revalidatePath("/admin/klasser");
    return ok();
  });
}

export async function renameClass(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("races.manage");
    const id = z.string().uuid().parse(formData.get("id"));
    const parsed = classSchema.safeParse({
      name: formData.get("name"),
      sortOrder: formData.get("sortOrder") || undefined,
    });
    if (!parsed.success) return fail(nb.errors.invalidInput);

    await db.transaction(async (tx) => {
      await tx.update(classes).set(parsed.data).where(eq(classes.id, id));
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "class.update",
        entityType: "Class",
        entityId: id,
        details: parsed.data,
      });
    });
    revalidatePath("/admin/klasser");
    return ok();
  });
}

/** Deletion is blocked while any race references the class (Races AC 9). */
export async function deleteClass(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const user = await requireCapability("races.manage");
    const id = z.string().uuid().parse(formData.get("id"));

    const referencing = await db
      .select({ id: races.id })
      .from(races)
      .where(eq(races.classId, id))
      .limit(1);
    if (referencing.length > 0) return fail("Kan ikke slette: klassen er i bruk av minst ett løp.");

    await db.transaction(async (tx) => {
      await tx.delete(classes).where(eq(classes.id, id));
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "class.delete",
        entityType: "Class",
        entityId: id,
      });
    });
    revalidatePath("/admin/klasser");
    return ok();
  });
}
