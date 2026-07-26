import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Auth boundary for the whole admin area. Gates on being logged in only (judges
 * render the shell too); leaf pages/actions keep their own capability checks.
 * The visible chrome (top bar) lives in the nested layouts — the global one under
 * (global) and the event-scoped one under e/[eventId] — so an event never shows
 * the global bar.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logg-inn");

  return <div className="admin-shell">{children}</div>;
}
