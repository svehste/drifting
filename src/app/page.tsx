import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { classes, events, races } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const eventRows = await db.select().from(events).orderBy(desc(events.startDate));
  const raceRows = await db
    .select({
      id: races.id,
      eventId: races.eventId,
      name: races.name,
      status: races.status,
      className: classes.name,
    })
    .from(races)
    .innerJoin(classes, eq(classes.id, races.classId))
    .orderBy(asc(races.name));
  const racesByEvent = new Map<string, typeof raceRows>();
  for (const r of raceRows) {
    if (!racesByEvent.has(r.eventId)) racesByEvent.set(r.eventId, []);
    racesByEvent.get(r.eventId)!.push(r);
  }

  return (
    <main className="container">
      <header className="admin-header" style={{ borderRadius: 12, marginBottom: "1.5rem" }}>
        <div>
          <div className="brand" style={{ fontSize: "1.2rem" }}>
            {nb.appName}
          </div>
          <div className="muted">{nb.tagline}</div>
        </div>
        <Link href="/logg-inn" className="btn-secondary">
          {nb.nav.signIn}
        </Link>
      </header>

      <h1>{nb.nav.events}</h1>
      {eventRows.length === 0 ? (
        <p className="muted">Ingen arrangementer ennå.</p>
      ) : (
        <div className="stack">
          {eventRows.map((e) => {
            const eventRaces = racesByEvent.get(e.id) ?? [];
            return (
              <div key={e.id} className="panel">
                <div className="leaderboard-head">
                  <strong>{e.name}</strong>
                  <span className="badge badge-unofficial">{nb.eventStatus[e.status]}</span>
                </div>
                <div className="muted">
                  {e.startDate} – {e.endDate}
                </div>
                {eventRaces.length === 0 ? (
                  <p className="muted">Ingen løp.</p>
                ) : (
                  <div className="table-scroll">
                    <table className="table">
                      <tbody>
                        {eventRaces.map((r) => (
                          <tr key={r.id}>
                            <td>{r.name}</td>
                            <td>{nb.raceStatus[r.status]}</td>
                            <td>
                              <Link href={`/lop/${r.id}/resultater`}>{nb.leaderboard.title}</Link>
                            </td>
                            <td>
                              <Link href={`/lop/${r.id}/cup`}>Finaler</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
