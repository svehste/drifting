import { asc } from "drizzle-orm";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { userRoles, users } from "@/db/schema";
import type { Role } from "@/domain/types";
import { createUser, deleteUser, updateUser } from "@/server/actions/users";
import { ActionForm } from "../_components/action-form";
import { DeleteForm } from "../_components/delete-form";
import { UserRoleFields } from "./user-role-fields";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [userRows, roleRows] = await Promise.all([
    db.select().from(users).orderBy(asc(users.lastName), asc(users.firstName)),
    db.select().from(userRoles),
  ]);
  const rolesByUser = new Map<string, Set<Role>>();
  for (const r of roleRows) {
    if (!rolesByUser.has(r.userId)) rolesByUser.set(r.userId, new Set());
    rolesByUser.get(r.userId)!.add(r.role);
  }

  return (
    <>
      <h1>{nb.nav.users}</h1>
      <p className="muted">Én brukertabell; roller bestemmer tilgang (Brukere AC 1).</p>

      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <h3>Ny bruker</h3>
        <ActionForm action={createUser} submitLabel={nb.actions.create} resetOnSuccess>
          <div className="grid-2">
            <label className="field">
              <span>Fornavn</span>
              <input name="firstName" required />
            </label>
            <label className="field">
              <span>Etternavn</span>
              <input name="lastName" required />
            </label>
            <label className="field">
              <span>E-post</span>
              <input name="email" type="email" required />
            </label>
            <label className="field">
              <span>Telefon</span>
              <input name="phone" />
            </label>
          </div>
          <UserRoleFields />
        </ActionForm>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Navn</th>
            <th>E-post</th>
            <th>Roller</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {userRows.map((u) => {
            const roles = rolesByUser.get(u.id) ?? new Set<Role>();
            return (
              <tr key={u.id}>
                <td>
                  {u.firstName} {u.lastName}
                </td>
                <td className="muted">{u.email}</td>
                <td>{[...roles].map((r) => nb.roles[r]).join(", ") || "—"}</td>
                <td>
                  <div className="row-actions">
                    <details>
                      <summary>{nb.actions.edit}</summary>
                      <ActionForm action={updateUser} submitLabel={nb.actions.save}>
                        <input type="hidden" name="id" value={u.id} />
                        <div className="grid-2">
                          <input name="firstName" defaultValue={u.firstName} required />
                          <input name="lastName" defaultValue={u.lastName} required />
                          <input name="email" type="email" defaultValue={u.email} required />
                          <input name="phone" defaultValue={u.phone ?? ""} />
                        </div>
                        <UserRoleFields
                          selected={[...roles]}
                          driver={{
                            club: u.club,
                            car: u.car,
                            startNumber: u.startNumber,
                            startNumberIsDummy: u.startNumberIsDummy,
                          }}
                        />
                      </ActionForm>
                    </details>
                    <DeleteForm
                      action={deleteUser}
                      hidden={{ id: u.id }}
                      label={nb.actions.delete}
                      confirm={`Slette ${u.firstName} ${u.lastName}?`}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
          {userRows.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted">
                Ingen brukere ennå.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
