import { notFound } from "next/navigation";
import { nb } from "@/copy/nb";
import { isUuid } from "@/lib/validation";
import { getDriverProfile, type DriverRaceEntry } from "@/server/queries/driver";

// Resolved per request from a private UUID; never statically rendered.
export const dynamic = "force-dynamic";

export default async function DriverPage({ params }: { params: { uuid: string } }) {
  if (!isUuid(params.uuid)) notFound();

  const profile = await getDriverProfile(params.uuid);
  if (!profile) notFound();

  const { contact, upcoming, historic } = profile;
  const fullName = `${contact.firstName} ${contact.lastName}`;

  return (
    <main className="container narrow">
      <h1>{fullName}</h1>

      {/* Contact info */}
      <div className="panel stack" style={{ marginTop: "1rem" }}>
        <Row label={nb.leaderboard.startNumber}>
          {contact.startNumber ?? "—"}
          {contact.startNumber && contact.startNumberIsDummy ? (
            <span className="tag"> ({nb.driverPage.dummyTag})</span>
          ) : null}
        </Row>
        <Row label={nb.driverPage.email}>{contact.email}</Row>
        <Row label={nb.driverPage.phone}>{contact.phone ?? "—"}</Row>
        <Row label={nb.leaderboard.club}>{contact.club ?? "—"}</Row>
        <Row label={nb.leaderboard.car}>{contact.car ?? "—"}</Row>
      </div>

      {/* Upcoming races */}
      <h2 style={{ marginTop: "2rem" }}>{nb.driverPage.upcoming}</h2>
      {upcoming.length === 0 ? (
        <p className="muted">{nb.driverPage.noUpcoming}</p>
      ) : (
        <div className="stack">
          {upcoming.map((e) => (
            <div key={e.registrationId} className="panel">
              <strong>{e.eventName}</strong>
              <div className="muted">
                {e.raceName} · {e.className} · {e.startDate} · {nb.raceStatus[e.raceStatus]}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historic races */}
      <h2 style={{ marginTop: "2rem" }}>{nb.driverPage.history}</h2>
      {historic.length === 0 ? (
        <p className="muted">{nb.driverPage.noHistory}</p>
      ) : (
        <div className="stack">
          {historic.map((e) => (
            <HistoricCard key={e.registrationId} entry={e} />
          ))}
        </div>
      )}
    </main>
  );
}

function HistoricCard({ entry }: { entry: DriverRaceEntry }) {
  return (
    <div className="panel">
      <strong>{entry.eventName}</strong>
      <div className="muted">
        {entry.raceName} · {entry.className} · {entry.startDate}
      </div>
      <div className="row" style={{ marginTop: "0.6rem" }}>
        <span className="muted">{nb.driverPage.qualifyingResult}</span>
        <span>
          {entry.qualifyingScore !== null ? (
            <>
              {entry.qualifyingScore} p
              {entry.qualifyingRank !== null ? ` · ${entry.qualifyingRank}. plass` : ""}
            </>
          ) : (
            nb.leaderboard.notApproved
          )}
        </span>
      </div>
      <div className="row">
        <span className="muted">{nb.driverPage.cupResult}</span>
        <span>{entry.finalPlace !== null ? `${entry.finalPlace}. plass` : "—"}</span>
      </div>
    </div>
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
