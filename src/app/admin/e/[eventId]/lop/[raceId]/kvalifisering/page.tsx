import { notFound } from "next/navigation";
import { nb } from "@/copy/nb";
import { isUuid } from "@/lib/validation";
import {
  lockQualifying,
  publishLeaderboard,
  unlockQualifying,
} from "@/server/actions/qualifying";
import { getLeaderboard, type RunCell } from "@/server/queries/leaderboard";
import { ActionForm } from "../../../../../_components/action-form";

export const dynamic = "force-dynamic";

function Cell({ cell }: { cell: RunCell }) {
  if (!cell.complete) return <td className="muted">—</td>;
  if (!cell.approved) return <td className="muted">{nb.leaderboard.notApproved}</td>;
  return (
    <td>
      <span className="run-breakdown">
        {cell.line}/{cell.angle}/{cell.style}
      </span>{" "}
      <strong className="run-total">{cell.total}</strong>
    </td>
  );
}

/** Kvalifisering tab — the leaderboard plus lock/unlock/publish controls. */
export default async function KvalifiseringTabPage({ params }: { params: { raceId: string } }) {
  if (!isUuid(params.raceId)) notFound();
  const data = await getLeaderboard(params.raceId);
  if (!data) notFound();

  const boardLabel =
    data.status === "official"
      ? nb.leaderboard.official
      : data.status === "unofficial"
        ? nb.leaderboard.unofficial
        : nb.leaderboard.inProgress;

  return (
    <>
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <p className="muted">
          Status: {data.qualifyingLocked ? "låst" : "åpen"} · Tavle: {boardLabel}
        </p>
        <div className="row-actions">
          {data.qualifyingLocked ? (
            <ActionForm action={unlockQualifying} submitLabel={nb.actions.unlock} className="inline-form">
              <input type="hidden" name="raceId" value={data.raceId} />
            </ActionForm>
          ) : (
            <ActionForm action={lockQualifying} submitLabel={nb.actions.lock} className="inline-form">
              <input type="hidden" name="raceId" value={data.raceId} />
            </ActionForm>
          )}
          <ActionForm action={publishLeaderboard} submitLabel={nb.actions.publish} className="inline-form">
            <input type="hidden" name="raceId" value={data.raceId} />
          </ActionForm>
        </div>
      </div>

      <div className="table-scroll">
        <table className="table leaderboard">
          <thead>
            <tr>
              <th>{nb.leaderboard.rank}</th>
              <th>{nb.leaderboard.startNumber}</th>
              <th>{nb.leaderboard.name}</th>
              <th>{nb.leaderboard.club}</th>
              <th>{nb.leaderboard.car}</th>
              <th>
                {nb.leaderboard.run} 1 <span className="muted">L/V/S</span>
              </th>
              <th>
                {nb.leaderboard.run} 2 <span className="muted">L/V/S</span>
              </th>
              <th>{nb.leaderboard.best}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.registrationId} className={r.eligible ? "" : "row-ineligible"}>
                <td>{r.rank ?? "—"}</td>
                <td>
                  {r.startNumber ?? "—"}
                  {r.startNumber && r.startNumberIsDummy ? (
                    <span className="tag"> ({nb.driverPage.dummyTag})</span>
                  ) : null}
                </td>
                <td>
                  {r.firstName} {r.lastName}
                </td>
                <td className="muted">{r.club ?? "—"}</td>
                <td className="muted">{r.car ?? "—"}</td>
                <Cell cell={r.runs[0]} />
                <Cell cell={r.runs[1]} />
                <td>
                  <strong>{r.best ?? "—"}</strong>
                </td>
              </tr>
            ))}
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  Ingen påmeldte ennå.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
