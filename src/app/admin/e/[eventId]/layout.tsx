import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { isUuid } from "@/lib/validation";
import { signOut } from "@/server/actions/auth-actions";
import { requireUser } from "@/server/authz";
import { NavLink } from "../../_components/nav-link";

export const dynamic = "force-dynamic";

/**
 * Event-scoped chrome. Gates on being logged in only (judges see the bar too);
 * capability checks stay at the leaves. When the event can't be resolved we bounce
 * to the Dashboard rather than 404, per the deep-link rule (UX_review1 §8).
 */
export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { eventId: string };
}) {
  const user = await requireUser();
  if (!isUuid(params.eventId)) redirect("/admin");
  const [event] = await db.select().from(events).where(eq(events.id, params.eventId)).limit(1);
  if (!event) redirect("/admin");

  const base = `/admin/e/${event.id}`;

  return (
    <>
      <header className="admin-header">
        <nav className="admin-nav">
          {/* The event-name button returns to the Dashboard to switch events. */}
          <Link href="/admin" className="brand" title="Bytt arrangement">
            {event.name} ▾
          </Link>
          <NavLink href={base} label={nb.nav.races} exact extraActive={[`${base}/lop`]} />
          <NavLink href={`${base}/innstillinger`} label="Innstillinger" />
        </nav>
        <div className="admin-user">
          <span className="muted">
            {user.firstName} {user.lastName}
          </span>
          <form action={signOut}>
            <button type="submit" className="btn-secondary">
              {nb.nav.signOut}
            </button>
          </form>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
