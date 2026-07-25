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
import { provisionStaffAuth } from "@/server/supabase-admin";
import { can } from "@/domain/permissions";
import { fail, guardAction, ok, type ActionResult } from "./_result";

const roleEnum = z.enum(["admin", "judge", "secretary", "driver"]);

/** Roles whose holder logs in with a password (everyone except a pure driver). */
const STAFF_ROLES: Role[] = ["admin", "judge", "secretary"];

const userSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  roles: z.array(roleEnum).default([]),
  // Staff login password — optional; only applied when a staff role is set and a
  // value is given (blank = keep the existing password).
  password: z.string().min(8).max(72).optional().or(z.literal("")),
  // Driver-specific fields (only surfaced in the form when the driver role is on).
  club: z.string().trim().max(120).optional().or(z.literal("")),
  car: z.string().trim().max(120).optional().or(z.literal("")),
  startNumber: z.string().trim().max(20).optional().or(z.literal("")),
  startNumberIsDummy: z.coerce.boolean().default(false),
});

type UserInput = z.infer<typeof userSchema>;

function parseUser(formData: FormData) {
  return userSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    roles: formData.getAll("roles"),
    password: formData.get("password") ?? "",
    club: formData.get("club") ?? "",
    car: formData.get("car") ?? "",
    startNumber: formData.get("startNumber") ?? "",
    startNumberIsDummy: formData.get("startNumberIsDummy") === "on",
  });
}

/** Driver columns on the users table; blank/false when the role isn't set. */
function driverValues(d: UserInput) {
  const isDriver = d.roles.includes("driver");
  return {
    club: isDriver ? d.club || null : null,
    car: isDriver ? d.car || null : null,
    startNumber: isDriver ? d.startNumber || null : null,
    startNumberIsDummy: isDriver ? d.startNumberIsDummy : false,
  };
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

/**
 * Provision the staff login for a user, returning the auth_user_id to persist.
 * No-ops (returns the incoming id) when no staff role is set, no password was
 * given, or service-role auth isn't configured (local dev).
 */
async function provisionPassword(
  data: UserInput,
  authUserId: string | null,
): Promise<string | null> {
  const hasStaffRole = data.roles.some((r) => STAFF_ROLES.includes(r));
  if (!hasStaffRole || !data.password) return authUserId;
  try {
    return (await provisionStaffAuth({ email: data.email, password: data.password, authUserId }))
      ?? authUserId;
  } catch {
    throw new AuthzError(nb.usersForm.passwordError);
  }
}

/** Identity + role-specific columns to persist on the users table. */
function userValues(d: UserInput) {
  return {
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    phone: d.phone || null,
    ...driverValues(d),
  };
}

export async function createUser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const parsed = parseUser(formData);
    if (!parsed.success) return fail(nb.errors.invalidInput);
    const data = parsed.data;
    const actor = await authorizeUserWrite(data.roles, []);
    const authUserId = await provisionPassword(data, null);

    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({ ...userValues(data), authUserId, status: "active" })
        .returning({ id: users.id });
      await setRoles(tx, row.id, data.roles);
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "user.create",
        entityType: "User",
        entityId: row.id,
        details: { email: data.email, roles: data.roles },
      });
    });
    revalidatePath("/admin/brukere");
    revalidatePath("/admin/forere");
    return ok();
  });
}

export async function updateUser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return guardAction(async () => {
    const id = z.string().uuid().parse(formData.get("id"));
    const parsed = parseUser(formData);
    if (!parsed.success) return fail(nb.errors.invalidInput);
    const data = parsed.data;

    const [existingUser] = await db
      .select({ authUserId: users.authUserId })
      .from(users)
      .where(eq(users.id, id));
    const existing = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, id));
    const actor = await authorizeUserWrite(data.roles, existing.map((r) => r.role));
    const authUserId = await provisionPassword(data, existingUser?.authUserId ?? null);

    await db.transaction(async (tx) => {
      await tx.update(users).set({ ...userValues(data), authUserId }).where(eq(users.id, id));
      await setRoles(tx, id, data.roles);
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "user.update",
        entityType: "User",
        entityId: id,
        details: { email: data.email, roles: data.roles },
      });
    });
    revalidatePath("/admin/brukere");
    revalidatePath("/admin/forere");
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
