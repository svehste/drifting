import { count, desc } from "drizzle-orm";
import Link from "next/link";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { events, races } from "@/db/schema";
import type { EventStatus } from "@/domain/types";
import { createEvent } from "@/server/actions/events";
import { ActionForm } from "../_components/action-form";

export const dynamic = "force-dynamic";

// Live events first so the event you're running is one click away (UX_review1 §6).
const statusRank: Record<EventStatus, number> = { ongoing: 0, upcoming: 1, finished: 2 };

const globalLinks = [
  { href: "/admin/klasser", label: nb.nav.classes },
  { href: "/admin/forere", label: `Alle ${nb.nav.drivers.toLowerCase()}` },
  { href: "/admin/brukere", label: `Alle ${nb.nav.users.toLowerCase()}` },
  { href: "/admin/logg", label: `Global ${nb.nav.auditLog.toLowerCase()}` },
];

export default async function DashboardPage() {
  const eventRows = await db.select().from(events).orderBy(desc(events.startDate));
  const raceCounts = await db
    .select({ eventId: races.eventId, n: count() })
    .from(races)
    .groupBy(races.eventId);
  const countByEvent = new Map(raceCounts.map((r) => [r.eventId, Number(r.n)]));

  const sorted = [...eventRows].sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] || b.startDate.localeCompare(a.startDate),
  );

  return (
    <>
      <h1>Dashboard</h1>

      <h2>Arrangementer</h2>
      {sorted.length === 0 ? (
        <p className="muted">Ingen arrangementer ennå — opprett ett nedenfor.</p>
      ) : (
        <div className="card-grid">
          {sorted.map((e) => {
            const n = countByEvent.get(e.id) ?? 0;
            return (
              <Link key={e.id} href={`/admin/e/${e.id}`} className="panel card-link">
                <h3>{e.name}</h3>
                <p className="muted">
                  {nb.eventStatus[e.status]} · {n} løp
                </p>
              </Link>
            );
          })}
        </div>
      )}

      <div className="panel" style={{ margin: "1.5rem 0" }}>
        <h3>Nytt arrangement</h3>
        <ActionForm action={createEvent} submitLabel={nb.actions.create} resetOnSuccess>
          <label className="field">
            <span>Navn</span>
            <input name="name" required maxLength={120} />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Startdato</span>
              <input name="startDate" type="date" required />
            </label>
            <label className="field">
              <span>Sluttdato</span>
              <input name="endDate" type="date" required />
            </label>
          </div>
        </ActionForm>
      </div>

      <p className="muted">
        Administrer:{" "}
        {globalLinks.map((l, i) => (
          <span key={l.href}>
            {i > 0 ? " · " : ""}
            <Link href={l.href}>{l.label}</Link>
          </span>
        ))}
      </p>
    </>
  );
}
