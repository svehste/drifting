/**
 * Supabase Auth server client (staff login only). Uses @supabase/ssr with
 * Next's cookie store so sessions are stored in httpOnly cookies and refreshed
 * in middleware. We use Supabase purely for auth — all app data is in our own
 * tables via Drizzle.
 */
import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

/** Server client bound to the current request's cookies. */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // In a Server Component the cookie store is read-only; middleware
          // handles the refresh write instead. Swallow that expected error.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            /* called from a Server Component — safe to ignore */
          }
        },
      },
    },
  );
}
