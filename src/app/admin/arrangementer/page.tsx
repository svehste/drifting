import { desc } from "drizzle-orm";
import Link from "next/link";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { createEvent } from "@/server/actions/events";
import { ActionForm } from "../_components/action-form";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const rows = await db.select().from(events).orderBy(desc(events.startDate));

  return (
    <>
      <h1>{nb.nav.events}</h1>

      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3>{nb.actions.create}</h3>
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

      <table className="table">
        <thead>
          <tr>
            <th>Navn</th>
            <th>Datoer</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>
                <Link href={`/admin/arrangementer/${e.id}`}>{e.name}</Link>
              </td>
              <td className="muted">
                {e.startDate} – {e.endDate}
              </td>
              <td>{nb.eventStatus[e.status]}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="muted">
                Ingen arrangementer ennå.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
