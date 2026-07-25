import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { classes, events, races } from "@/db/schema";
import { isUuid } from "@/lib/validation";
import { createRace, deleteRace } from "@/server/actions/races";
import { deleteEvent, updateEvent } from "@/server/actions/events";
import { ActionForm } from "../../_components/action-form";
import { DeleteForm } from "../../_components/delete-form";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const [event] = await db.select().from(events).where(eq(events.id, params.id)).limit(1);
  if (!event) notFound();

  const [raceRows, classRows] = await Promise.all([
    db.select().from(races).where(eq(races.eventId, event.id)).orderBy(asc(races.name)),
    db.select().from(classes).orderBy(asc(classes.sortOrder), asc(classes.name)),
  ]);
  const classNameById = new Map(classRows.map((c) => [c.id, c.name]));

  return (
    <>
      <p className="muted">
        <Link href="/admin/arrangementer">← {nb.nav.events}</Link>
      </p>
      <h1>{event.name}</h1>

      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3>{nb.actions.edit}</h3>
        <ActionForm action={updateEvent} submitLabel={nb.actions.save}>
          <input type="hidden" name="id" value={event.id} />
          <label className="field">
            <span>Navn</span>
            <input name="name" defaultValue={event.name} required />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Startdato</span>
              <input name="startDate" type="date" defaultValue={event.startDate} required />
            </label>
            <label className="field">
              <span>Sluttdato</span>
              <input name="endDate" type="date" defaultValue={event.endDate} required />
            </label>
          </div>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={event.status}>
              <option value="upcoming">{nb.eventStatus.upcoming}</option>
              <option value="ongoing">{nb.eventStatus.ongoing}</option>
              <option value="finished">{nb.eventStatus.finished}</option>
            </select>
          </label>
        </ActionForm>
        <div style={{ marginTop: "1rem" }}>
          <DeleteForm
            action={deleteEvent}
            hidden={{ id: event.id }}
            label={`${nb.actions.delete} arrangement`}
            confirm={`Slette «${event.name}»? Dette er blokkert om noen løp har resultater.`}
          />
        </div>
      </div>

      <h2>{nb.nav.races}</h2>
      {classRows.length === 0 ? (
        <p className="error">Opprett minst én klasse først (Klasser).</p>
      ) : (
        <div className="panel" style={{ marginBottom: "1.5rem" }}>
          <h3>Nytt løp</h3>
          <ActionForm action={createRace} submitLabel={nb.actions.create} resetOnSuccess>
            <input type="hidden" name="eventId" value={event.id} />
            <div className="grid-2">
              <label className="field">
                <span>Navn</span>
                <input name="name" required placeholder="Pro 1" />
              </label>
              <label className="field">
                <span>Klasse</span>
                <select name="classId" required>
                  {classRows.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Cup-størrelse</span>
                <select name="cupSize" defaultValue="16">
                  <option value="4">4</option>
                  <option value="8">8</option>
                  <option value="16">16</option>
                  <option value="32">32</option>
                </select>
              </label>
            </div>
          </ActionForm>
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Løp</th>
            <th>Klasse</th>
            <th>Cup</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {raceRows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/admin/lop/${r.id}`}>{r.name}</Link>
              </td>
              <td className="muted">{classNameById.get(r.classId) ?? "—"}</td>
              <td>{r.cupSize}</td>
              <td>{nb.raceStatus[r.status]}</td>
              <td>
                <DeleteForm
                  action={deleteRace}
                  hidden={{ id: r.id, eventId: event.id }}
                  label={nb.actions.delete}
                  confirm={`Slette løpet «${r.name}»?`}
                />
              </td>
            </tr>
          ))}
          {raceRows.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                Ingen løp ennå.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
