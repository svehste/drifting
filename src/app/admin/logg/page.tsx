import { desc, eq } from "drizzle-orm";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { auditLogs, users } from "@/db/schema";
import { AuthzError, requireCapability } from "@/server/authz";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  try {
    await requireCapability("auditLog.view");
  } catch (err) {
    if (err instanceof AuthzError) {
      return (
        <>
          <h1>{nb.nav.auditLog}</h1>
          <p className="error">{nb.errors.unauthorized}</p>
        </>
      );
    }
    throw err;
  }

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      createdAt: auditLogs.createdAt,
      details: auditLogs.details,
      actorFirst: users.firstName,
      actorLast: users.lastName,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  return (
    <>
      <h1>{nb.nav.auditLog}</h1>
      <p className="muted">Kun lesbar; append-only (Logg AC 2).</p>
      <table className="table">
        <thead>
          <tr>
            <th>Tid</th>
            <th>Hvem</th>
            <th>Handling</th>
            <th>Objekt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="muted">{new Date(r.createdAt).toLocaleString("nb-NO")}</td>
              <td>{r.actorFirst ? `${r.actorFirst} ${r.actorLast}` : "—"}</td>
              <td>
                <code>{r.action}</code>
              </td>
              <td className="muted">{r.entityType}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted">
                Ingen loggførte handlinger ennå.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
