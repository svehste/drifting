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
  authUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
}

/**
 * The authenticated staff user, or null if not logged in / not linked to an app
 * user. Memoised per request so repeated calls in one render don't re-query.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const row = await db
    .select({
      id: users.id,
      authUserId: users.authUserId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.authUserId, user.id))
    .limit(1);

  const appUser = row[0];
  if (!appUser?.authUserId) return null;

  const roleRows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, appUser.id));

  return {
    id: appUser.id,
    authUserId: appUser.authUserId,
    email: appUser.email,
    firstName: appUser.firstName,
    lastName: appUser.lastName,
    roles: roleRows.map((r) => r.role),
  };
});
