"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { nb } from "@/copy/nb";
import type { LeaderboardData, RunCell } from "@/server/queries/leaderboard";

const POLL_MS = 5000;

function StatusBadge({ data }: { data: LeaderboardData }) {
  const label =
    data.status === "official"
      ? nb.leaderboard.official
      : !data.qualifyingLocked
        ? nb.leaderboard.inProgress
        : nb.leaderboard.unofficial;
  const cls =
    data.status === "official" ? "badge badge-official" : "badge badge-unofficial";
  return <span className={cls}>{label}</span>;
}

function Cell({ cell }: { cell: RunCell }) {
  if (!cell.complete) return <td className="muted">—</td>;
  if (!cell.approved) return <td className="muted">{nb.leaderboard.notApproved}</td>;
  return (
    <td>
      <span className="run-breakdown">
        {cell.line}/{cell.angle}/{cell.style}
      </span>
      <strong className="run-total">{cell.total}</strong>
    </td>
  );
}

export function LeaderboardView({ initial }: { initial: LeaderboardData }) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/lop/${initial.raceId}/resultater`, { cache: "no-store" });
        if (res.ok && alive) setData(await res.json());
      } catch {
        /* transient network error — keep last data, try again next tick */
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initial.raceId]);

  return (
    <>
      <p className="muted">
        <Link href="/">← {nb.nav.home}</Link>
      </p>
      <div className="leaderboard-head">
        <h1>{data.raceName}</h1>
        <StatusBadge data={data} />
      </div>
      <p className="muted">{nb.leaderboard.title}</p>

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
