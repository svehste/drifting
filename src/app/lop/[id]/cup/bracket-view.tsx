"use client";

import { useEffect, useState } from "react";
import { nb } from "@/copy/nb";
import type { BracketBattle, BracketData, BracketDriver } from "@/server/queries/bracket";

const POLL_MS = 5000;

function DriverLine({
  driver,
  isWinner,
}: {
  driver: BracketDriver | null;
  isWinner: boolean;
}) {
  return (
    <div className={`bd-driver ${isWinner ? "is-winner" : ""}`}>
      {driver ? (
        <>
          {driver.startNumber ? <span className="bd-nr">#{driver.startNumber}</span> : null}
          <span className="bd-name">{driver.name}</span>
          {driver.seed ? <span className="bd-seed">({driver.seed})</span> : null}
        </>
      ) : (
        <span className="muted">{nb.leaderboard.bye}</span>
      )}
    </div>
  );
}

function BattleCard({ battle }: { battle: BracketBattle }) {
  const w = battle.winnerRegistrationId;
  return (
    <div className={`bd-battle status-${battle.status}`}>
      <DriverLine driver={battle.a} isWinner={!!w && battle.a?.registrationId === w} />
      <DriverLine driver={battle.b} isWinner={!!w && battle.b?.registrationId === w} />
      {battle.status === "omt" ? <span className="bd-omt">{nb.actions.omt}</span> : null}
    </div>
  );
}

export function BracketView({ initial }: { initial: BracketData }) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    let alive = true;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/lop/${initial.raceId}/cup`, { cache: "no-store" });
        if (res.ok && alive) setData(await res.json());
      } catch {
        /* keep last data */
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initial.raceId]);

  if (!data.exists) {
    return (
      <>
        <h1>{data.raceName}</h1>
        <p className="muted">Cupen er ikke generert ennå.</p>
      </>
    );
  }

  return (
    <>
      <h1>{data.raceName} — Cup</h1>

      {data.finished && data.podium.length > 0 ? (
        <div className="panel podium">
          <h3>Sluttplasseringer</h3>
          <ol className="podium-list">
            {data.podium.map((p) => (
              <li key={p.place}>
                <span className="podium-place">{p.place}.</span>{" "}
                {p.startNumber ? <span className="bd-nr">#{p.startNumber}</span> : null} {p.name}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="bracket-scroll">
        <div className="bracket">
          {data.rounds.map((col) => (
            <div key={col.round} className="bracket-col">
              <h4>{nb.round[col.round]}</h4>
              {col.battles.map((b) => (
                <BattleCard key={b.id} battle={b} />
              ))}
            </div>
          ))}
          {data.bronsefinal ? (
            <div className="bracket-col">
              <h4>{nb.round.bronsefinal}</h4>
              <BattleCard battle={data.bronsefinal} />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
