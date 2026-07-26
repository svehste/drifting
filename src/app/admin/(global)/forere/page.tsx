import { and, asc, eq } from "drizzle-orm";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { userRoles, users } from "@/db/schema";
import { createDriver, deleteDriver, updateDriver } from "@/server/actions/drivers";
import { ActionForm } from "../../_components/action-form";
import { DeleteForm } from "../../_components/delete-form";

export const dynamic = "force-dynamic";

function DriverFields({
  d,
}: {
  d?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    club: string | null;
    car: string | null;
    startNumber: string | null;
    startNumberIsDummy: boolean;
  };
}) {
  return (
    <>
      <div className="grid-2">
        <label className="field">
          <span>Fornavn</span>
          <input name="firstName" defaultValue={d?.firstName} required />
        </label>
        <label className="field">
          <span>Etternavn</span>
          <input name="lastName" defaultValue={d?.lastName} required />
        </label>
        <label className="field">
          <span>E-post</span>
          <input name="email" type="email" defaultValue={d?.email} required />
        </label>
        <label className="field">
          <span>{nb.driverPage.phone}</span>
          <input name="phone" defaultValue={d?.phone ?? ""} />
        </label>
        <label className="field">
          <span>{nb.leaderboard.club}</span>
          <input name="club" defaultValue={d?.club ?? ""} />
        </label>
        <label className="field">
          <span>{nb.leaderboard.car}</span>
          <input name="car" defaultValue={d?.car ?? ""} />
        </label>
        <label className="field">
          <span>{nb.leaderboard.startNumber}</span>
          <input name="startNumber" defaultValue={d?.startNumber ?? ""} />
        </label>
        <label className="checkbox" style={{ alignSelf: "end" }}>
          <input type="checkbox" name="startNumberIsDummy" defaultChecked={d?.startNumberIsDummy} />
          {nb.driverPage.dummyTag}
        </label>
      </div>
    </>
  );
}

export default async function DriversPage() {
  const rows = await db
    .select()
    .from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "driver")))
    .orderBy(asc(users.lastName), asc(users.firstName));
  const drivers = rows.map((r) => r.users);

  return (
    <>
      <h1>{nb.nav.drivers}</h1>
      <p className="muted">En fører er en bruker med rollen fører (Førere AC 1).</p>

      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3>Ny fører</h3>
        <ActionForm action={createDriver} submitLabel={nb.actions.create} resetOnSuccess>
          <DriverFields />
        </ActionForm>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Startnr.</th>
            <th>Navn</th>
            <th>Klubb</th>
            <th>Bil</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.id}>
              <td>
                {d.startNumber ?? "—"}
                {d.startNumber && d.startNumberIsDummy ? (
                  <span className="tag"> ({nb.driverPage.dummyTag})</span>
                ) : null}
              </td>
              <td>
                {d.firstName} {d.lastName}
              </td>
              <td className="muted">{d.club ?? "—"}</td>
              <td className="muted">{d.car ?? "—"}</td>
              <td>
                <div className="row-actions">
                  <details>
                    <summary>{nb.actions.edit}</summary>
                    <ActionForm action={updateDriver} submitLabel={nb.actions.save}>
                      <input type="hidden" name="id" value={d.id} />
                      <DriverFields d={d} />
                    </ActionForm>
                  </details>
                  <DeleteForm
                    action={deleteDriver}
                    hidden={{ id: d.id }}
                    label={nb.actions.delete}
                    confirm={`Slette ${d.firstName} ${d.lastName}? Blokkeres om føreren har resultater.`}
                  />
                </div>
              </td>
            </tr>
          ))}
          {drivers.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                Ingen førere ennå.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
