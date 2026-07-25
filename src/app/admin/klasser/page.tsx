import { asc } from "drizzle-orm";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { classes } from "@/db/schema";
import { createClass, deleteClass, renameClass } from "@/server/actions/classes";
import { ActionForm } from "../_components/action-form";
import { DeleteForm } from "../_components/delete-form";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const rows = await db.select().from(classes).orderBy(asc(classes.sortOrder), asc(classes.name));

  return (
    <>
      <h1>{nb.nav.classes}</h1>
      <p className="muted">Delt liste brukt av alle løp (Løp AC 9).</p>

      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3>{nb.actions.create}</h3>
        <ActionForm action={createClass} submitLabel={nb.actions.create} resetOnSuccess>
          <div className="grid-2">
            <label className="field">
              <span>Navn</span>
              <input name="name" required maxLength={80} placeholder="Pro" />
            </label>
            <label className="field">
              <span>Sortering</span>
              <input name="sortOrder" type="number" placeholder="1" />
            </label>
          </div>
        </ActionForm>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Navn</th>
            <th>Sortering</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td colSpan={3}>
                <div className="row-actions">
                  <ActionForm action={renameClass} submitLabel={nb.actions.save} className="inline-form">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="name" defaultValue={c.name} required maxLength={80} />
                    <input
                      name="sortOrder"
                      type="number"
                      defaultValue={c.sortOrder ?? ""}
                      style={{ width: "5rem" }}
                    />
                  </ActionForm>
                  <DeleteForm
                    action={deleteClass}
                    hidden={{ id: c.id }}
                    label={nb.actions.delete}
                    confirm={`Slette klassen «${c.name}»?`}
                  />
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="muted">
                Ingen klasser ennå.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
