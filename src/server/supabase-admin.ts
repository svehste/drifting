/**
 * Supabase service-role admin client (server-only). Used for the admin-driven
 * staff flow: creating a staff user's auth identity and setting/updating their
 * login password (DEPLOY.md → "Staff auth"). Never import this from client code
 * — it carries the service-role key.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Whether the service-role admin API is configured (URL + service-role key). */
export function supabaseAdminConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Best-effort lookup of an existing auth user by email (small staff lists). */
async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return null;
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

/**
 * Provision (create or update) the Supabase auth identity for a staff user and
 * return its id so callers can persist it to `users.auth_user_id`.
 *
 * - With an existing `authUserId`: updates the email + password in place.
 * - Without one: creates the auth user (email pre-confirmed), falling back to an
 *   in-place password update if that email is already registered (e.g. the
 *   seeded admin).
 * - Returns `null` when service-role auth isn't configured (local dev) so the
 *   caller can no-op gracefully.
 *
 * Throws on a genuine Supabase error; the calling action maps it to a friendly
 * message.
 */
export async function provisionStaffAuth(params: {
  email: string;
  password: string;
  authUserId: string | null;
}): Promise<string | null> {
  if (!supabaseAdminConfigured()) return null;
  const admin = adminClient();
  const { email, password } = params;

  if (params.authUserId) {
    // Only touch the password here — updating the email in the same call can be
    // rejected by Supabase (e.g. when it's unchanged or needs re-confirmation).
    const { error } = await admin.auth.admin.updateUserById(params.authUserId, { password });
    if (error) throw new Error(error.message);
    return params.authUserId;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error && data.user) return data.user.id;

  // Email already has an auth identity we're not yet linked to: adopt it and
  // set the requested password.
  const existingId = await findAuthUserIdByEmail(admin, email);
  if (existingId) {
    const { error: updateError } = await admin.auth.admin.updateUserById(existingId, { password });
    if (updateError) throw new Error(updateError.message);
    return existingId;
  }

  throw new Error(error?.message ?? "Kunne ikke opprette innlogging.");
}
