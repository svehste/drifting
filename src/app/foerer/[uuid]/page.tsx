import { notFound } from "next/navigation";
import { nb } from "@/copy/nb";
import { isUuid } from "@/lib/validation";
import { getDriverByUuid } from "@/server/queries/driver";

// Resolved per request from a private UUID; never statically rendered.
export const dynamic = "force-dynamic";

export default async function DriverPage({ params }: { params: { uuid: string } }) {
  if (!isUuid(params.uuid)) notFound();

  const driver = await getDriverByUuid(params.uuid);
  if (!driver) notFound();

  const fullName = `${driver.firstName} ${driver.lastName}`;

  return (
    <main className="container narrow">
      <h1>{fullName}</h1>
      <p className="muted">{nb.driverPage.contact}</p>

      <div className="panel stack" style={{ marginTop: "1rem" }}>
        <Row label={nb.leaderboard.startNumber}>
          {driver.startNumber ?? "—"}
          {driver.startNumber && driver.startNumberIsDummy ? (
            <span className="tag"> ({nb.driverPage.dummyTag})</span>
          ) : null}
        </Row>
        <Row label={nb.driverPage.email}>{driver.email}</Row>
        <Row label={nb.driverPage.phone}>{driver.phone ?? "—"}</Row>
        <Row label={nb.leaderboard.club}>{driver.club ?? "—"}</Row>
        <Row label={nb.leaderboard.car}>{driver.car ?? "—"}</Row>
      </div>

      {/* Upcoming + historic races land here in M7. The page is fully read-only. */}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="row">
      <span className="muted">{label}</span>
      <span>{children}</span>
    </div>
  );
}
