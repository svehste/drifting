import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { classes, races } from "@/db/schema";
import { createRace, deleteRace } from "@/server/actions/races";
import { ActionForm } from "../../_components/action-form";
import { DeleteForm } from "../../_components/delete-form";

export const dynamic = "force-dynamic";

/** Løp tab — the event's races (event existence is guaranteed by the layout). */
export default async function EventRacesPage({ params }: { params: { eventId: string } }) {
  const [raceRows, classRows] = await Promise.all([
    db.select().from(races).where(eq(races.eventId, params.eventId)).orderBy(asc(races.name)),
    db.select().from(classes).orderBy(asc(classes.sortOrder), asc(classes.name)),
  ]);
  const classNameById = new Map(classRows.map((c) => [c.id, c.name]));

  return (
    <>
      <h1>{nb.nav.races}</h1>

      {classRows.length === 0 ? (
        <p className="error">Opprett minst én klasse først (Klasser).</p>
      ) : (
        <div className="panel" style={{ marginBottom: "1.5rem" }}>
          <h3>Nytt løp</h3>
          <ActionForm action={createRace} submitLabel={nb.actions.create} resetOnSuccess>
            <input type="hidden" name="eventId" value={params.eventId} />
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
                <span>Finaler-størrelse</span>
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
            <th>Finaler</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {raceRows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={`/admin/e/${params.eventId}/lop/${r.id}`}>{r.name}</Link>
              </td>
              <td className="muted">{classNameById.get(r.classId) ?? "—"}</td>
              <td>{r.cupSize}</td>
              <td>{nb.raceStatus[r.status]}</td>
              <td>
                <DeleteForm
                  action={deleteRace}
                  hidden={{ id: r.id, eventId: params.eventId }}
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
