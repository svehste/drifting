import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { races } from "@/db/schema";
import { isUuid } from "@/lib/validation";
import { generateBracket, regenerateBracket } from "@/server/actions/cup";
import { getBracket } from "@/server/queries/bracket";
import { ActionForm } from "../../../../../_components/action-form";
import { DeleteForm } from "../../../../../_components/delete-form";
import { BattleAdmin } from "./battle-admin";

export const dynamic = "force-dynamic";

/** Finaler tab — bracket admin (generate/regenerate/decide). */
export default async function FinalerTabPage({
  params,
}: {
  params: { eventId: string; raceId: string };
}) {
  if (!isUuid(params.raceId)) notFound();
  const [race] = await db.select().from(races).where(eq(races.id, params.raceId)).limit(1);
  if (!race) notFound();
  const data = await getBracket(params.raceId);
  if (!data) notFound();

  return (
    <>
      <div className="leaderboard-head">
        <h2>Finaler</h2>
        <Link href={`/lop/${race.id}/cup`} className="btn-secondary" target="_blank">
          Offentlig finaler-visning ↗
        </Link>
      </div>

      {!data.exists ? (
        <div className="panel">
          <h3>{nb.actions.generateBracket}</h3>
          {race.qualifyingLocked ? (
            <ActionForm action={generateBracket} submitLabel={nb.actions.generateBracket} className="inline-form">
              <input type="hidden" name="raceId" value={race.id} />
            </ActionForm>
          ) : (
            <p className="error">Lås kvalifiseringen først (Kvalifisering-fanen).</p>
          )}
        </div>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: "1.5rem" }}>
            <div className="row-actions">
              <DeleteForm
                action={regenerateBracket}
                hidden={{ raceId: race.id }}
                label={nb.actions.regenerateBracket}
                confirm="Regenerere stigen? Alle battle-resultater og OMT nullstilles."
              />
              {data.finished ? <span className="badge badge-official">Ferdig</span> : null}
            </div>
          </div>

          {data.finished && data.podium.length > 0 ? (
            <div className="panel podium" style={{ marginBottom: "1.5rem" }}>
              <h3>Sluttplasseringer</h3>
              <ol className="podium-list">
                {data.podium.map((p) => (
                  <li key={p.place}>
                    <span className="podium-place">{p.place}.</span>{" "}
                    {p.startNumber ? `#${p.startNumber} ` : ""}
                    {p.name}
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
                    <BattleAdmin key={b.id} battle={b} />
                  ))}
                </div>
              ))}
              {data.bronsefinal ? (
                <div className="bracket-col">
                  <h4>{nb.round.bronsefinal}</h4>
                  <BattleAdmin battle={data.bronsefinal} />
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
