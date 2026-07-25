/**
 * Resolve the current staff user and their role(s) from the request.
 * Roles are loaded from our user_role table on every request (build_plan M3).
 */
import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userRoles, users } from "@/db/schema";
import type { Role } from "@/domain/types";
import { createSupabaseServerClient } from "./supabase";

export interface CurrentUser {
  id: string;
  authUserId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
}

async function loadRoles(userId: string): Promise<Role[]> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

const userColumns = {
  id: users.id,
  authUserId: users.authUserId,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
};

async function getUserByEmail(email: string): Promise<CurrentUser | null> {
  const row = await db.select(userColumns).from(users).where(eq(users.email, email)).limit(1);
  const u = row[0];
  if (!u) return null;
  return { ...u, roles: await loadRoles(u.id) };
}

/**
 * The authenticated staff user, or null if not logged in / not linked to an app
 * user. Memoised per request so repeated calls in one render don't re-query.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Dev-only opt-in: with no Supabase configured, act as a named user so the
  // admin area is usable with just a DATABASE_URL. Never active in production.
  const devEmail = process.env.DEV_ADMIN_EMAIL;
  if (devEmail && !process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NODE_ENV !== "production") {
    return getUserByEmail(devEmail);
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const row = await db.select(userColumns).from(users).where(eq(users.authUserId, user.id)).limit(1);
  const appUser = row[0];
  if (!appUser?.authUserId) return null;

  return { ...appUser, roles: await loadRoles(appUser.id) };
});
