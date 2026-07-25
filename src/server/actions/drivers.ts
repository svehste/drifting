"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { userRoles, users } from "@/db/schema";
import { writeAudit } from "@/server/audit";
import { requireCapability } from "@/server/authz";
import { driverHasResults } from "@/server/guards";
import { fail, guardAction, ok, type ActionResult } from "./_result";

const driverSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  club: z.string().trim().max(120).optional().or(z.literal("")),
  car: z.string().trim().max(120).optional().or(z.literal("")),
  startNumber: z.string().trim().max(20).optional().or(z.literal("")),
  startNumberIsDummy: z.coerce.boolean().default(false),
});

function parseDriver(formData: FormData) {
  return driverSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    club: formData.get("club") ?? "",
    car: formData.get("car") ?? "",
    startNumber: formData.get("startNumber") ?? "",
    startNumberIsDummy: formData.get("startNumberIsDummy") === "on",
  });
}

function toValues(d: z.infer<typeof driverSchema>) {
  return {
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    phone: d.phone || null,
    club: d.club || null,
    car: d.car || null,
    startNumber: d.startNumber || null,
    startNumberIsDummy: d.startNumberIsDummy,
  };
}

/** Admins and secretaries manage drivers (Drivers AC 2). */
export async function createDriver(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const actor = await requireCapability("drivers.manage");
    const parsed = parseDriver(formData);
    if (!parsed.success) return fail(nb.errors.invalidInput);

    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({ ...toValues(parsed.data), status: "active" })
        .returning({ id: users.id });
      await tx.insert(userRoles).values({ userId: row.id, role: "driver" }).onConflictDoNothing();
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "driver.create",
        entityType: "User",
        entityId: row.id,
        details: toValues(parsed.data),
      });
    });
    revalidatePath("/admin/forere");
    return ok();
  });
}

export async function updateDriver(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const actor = await requireCapability("drivers.manage");
    const id = z.string().uuid().parse(formData.get("id"));
    const parsed = parseDriver(formData);
    if (!parsed.success) return fail(nb.errors.invalidInput);

    await db.transaction(async (tx) => {
      await tx.update(users).set(toValues(parsed.data)).where(eq(users.id, id));
      await tx.insert(userRoles).values({ userId: id, role: "driver" }).onConflictDoNothing();
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "driver.update",
        entityType: "User",
        entityId: id,
        details: toValues(parsed.data),
      });
    });
    revalidatePath("/admin/forere");
    return ok();
  });
}

/** Blocked when the driver has results in any race (Drivers AC 7). */
export async function deleteDriver(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const actor = await requireCapability("drivers.manage");
    const id = z.string().uuid().parse(formData.get("id"));

    if (await driverHasResults(id)) return fail(nb.errors.deleteBlockedResults);

    await db.transaction(async (tx) => {
      // Only remove the driver role if the user also holds other roles; otherwise
      // delete the user entirely.
      const roles = await tx
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, id));
      const otherRoles = roles.filter((r) => r.role !== "driver");
      if (otherRoles.length > 0) {
        await tx
          .delete(userRoles)
          .where(and(eq(userRoles.userId, id), eq(userRoles.role, "driver")));
      } else {
        await tx.delete(users).where(eq(users.id, id));
      }
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "driver.delete",
        entityType: "User",
        entityId: id,
      });
    });
    revalidatePath("/admin/forere");
    return ok();
  });
}
