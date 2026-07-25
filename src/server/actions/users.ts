"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { userRoles, users } from "@/db/schema";
import type { Role } from "@/domain/types";
import { writeAudit } from "@/server/audit";
import { AuthzError, requireUser } from "@/server/authz";
import { can } from "@/domain/permissions";
import { fail, guardAction, ok, type ActionResult } from "./_result";

const roleEnum = z.enum(["admin", "judge", "secretary", "driver"]);

const userSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  roles: z.array(roleEnum).default([]),
});

function parseUser(formData: FormData) {
  return userSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    roles: formData.getAll("roles"),
  });
}

/**
 * Authorize a user write given the roles involved. Granting or touching the
 * admin role needs users.manageAdmin; otherwise users.manageNonAdmin is enough
 * (Users AC 3–4; a secretary can never create admins or grant the admin role).
 */
async function authorizeUserWrite(newRoles: Role[], existingRoles: Role[]) {
  const actor = await requireUser();
  const touchesAdmin = newRoles.includes("admin") || existingRoles.includes("admin");
  const required = touchesAdmin ? "users.manageAdmin" : "users.manageNonAdmin";
  if (!can(actor.roles, required)) throw new AuthzError(nb.errors.unauthorized);
  return actor;
}

async function setRoles(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, roles: Role[]) {
  await tx.delete(userRoles).where(eq(userRoles.userId, userId));
  if (roles.length > 0) {
    await tx.insert(userRoles).values(roles.map((role) => ({ userId, role })));
  }
}

export async function createUser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const parsed = parseUser(formData);
    if (!parsed.success) return fail(nb.errors.invalidInput);
    const { roles, phone, ...identity } = parsed.data;
    const actor = await authorizeUserWrite(roles, []);

    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({ ...identity, phone: phone || null, status: "active" })
        .returning({ id: users.id });
      await setRoles(tx, row.id, roles);
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "user.create",
        entityType: "User",
        entityId: row.id,
        details: { ...identity, roles },
      });
    });
    revalidatePath("/admin/brukere");
    return ok();
  });
}

export async function updateUser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const id = z.string().uuid().parse(formData.get("id"));
    const parsed = parseUser(formData);
    if (!parsed.success) return fail(nb.errors.invalidInput);
    const { roles, phone, ...identity } = parsed.data;

    const existing = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, id));
    const actor = await authorizeUserWrite(roles, existing.map((r) => r.role));

    await db.transaction(async (tx) => {
      await tx.update(users).set({ ...identity, phone: phone || null }).where(eq(users.id, id));
      await setRoles(tx, id, roles);
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "user.update",
        entityType: "User",
        entityId: id,
        details: { ...identity, roles },
      });
    });
    revalidatePath("/admin/brukere");
    return ok();
  });
}

export async function deleteUser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const id = z.string().uuid().parse(formData.get("id"));
    const existing = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, id));
    const actor = await authorizeUserWrite([], existing.map((r) => r.role));

    await db.transaction(async (tx) => {
      await tx.delete(users).where(eq(users.id, id));
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "user.delete",
        entityType: "User",
        entityId: id,
      });
    });
    revalidatePath("/admin/brukere");
    return ok();
  });
}
