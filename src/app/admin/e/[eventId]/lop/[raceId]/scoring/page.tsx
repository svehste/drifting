import { and, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { nb } from "@/copy/nb";
import { db } from "@/db/client";
import { raceOfficials } from "@/db/schema";
import type { Criterion } from "@/domain/types";
import { isUuid } from "@/lib/validation";
import { AuthzError, requireCapability } from "@/server/authz";
import { getScoringData } from "@/server/queries/scoring";
import { ScoreCell } from "./score-cell";

export const dynamic = "force-dynamic";

const CRITERIA: Criterion[] = ["line", "angle", "style"];

/**
 * Scoring tab — the judge score-entry grid, now inside the admin shell so the top
 * bar and workspace tabs stay visible while scoring (the core fix in UX_review1).
 * Keeps the scores.enter gate and the per-criterion editable check; users without
 * scores.enter (e.g. secretaries) degrade to a read-only "no access" message
 * rather than throwing a full-page error (UX_review1 §5).
 */
export default async function ScoringTabPage({ params }: { params: { raceId: string } }) {
  if (!isUuid(params.raceId)) notFound();

  let user;
  try {
    user = await requireCapability("scores.enter");
  } catch (err) {
    if (err instanceof AuthzError) {
      return <p className="error">{err.message}</p>;
    }
    throw err;
  }

  const data = await getScoringData(params.raceId);
  if (!data) notFound();

  // Which criteria may this user edit? Admins: all. Judges: their assigned duties.
  let editable = new Set<Criterion>();
  if (user.roles.includes("admin")) {
    editable = new Set(CRITERIA);
  } else {
    const duties = await db
      .select({ duty: raceOfficials.duty })
      .from(raceOfficials)
      .where(
        and(
          eq(raceOfficials.raceId, params.raceId),
          eq(raceOfficials.userId, user.id),
          inArray(raceOfficials.duty, CRITERIA),
        ),
      );
    editable = new Set(duties.map((d) => d.duty as Criterion));
  }

  const maxFor = (c: Criterion): { a: number; b?: number } =>
    c === "line"
      ? { a: data.maxLine }
      : c === "angle"
        ? { a: data.maxAngle }
        : { a: data.maxStyleFlow, b: data.maxStyleEffort };

  return (
    <>
      <p className="muted">
        Du scorer:{" "}
        {editable.size ? [...editable].map((c) => nb.criterion[c]).join(", ") : "ingen kriterier"}
      </p>

      {data.qualifyingLocked ? (
        <p className="badge badge-unofficial">Kvalifiseringen er låst — poeng er skrivebeskyttet.</p>
      ) : null}

      {data.registrations.length === 0 ? (
        <p className="muted">Ingen påmeldte førere.</p>
      ) : (
        data.registrations.map((reg) => (
          <div key={reg.registrationId} className="panel driver-card">
            <h3>
              {reg.startNumber ? <span className="startnr">#{reg.startNumber}</span> : null}{" "}
              {reg.firstName} {reg.lastName}
            </h3>
            <div className="runs">
              {reg.runs.map((run) => (
                <div key={run.runId} className="run-block">
                  <div className="run-head">
                    {nb.leaderboard.run} {run.runNumber}
                    {run.status === "complete" ? (
                      <span className="badge badge-official"> {run.total}</span>
                    ) : (
                      <span className="muted"> (ufullstendig)</span>
                    )}
                  </div>
                  <div className="cells">
                    {CRITERIA.map((c) => {
                      const m = maxFor(c);
                      return (
                        <ScoreCell
                          key={c}
                          runId={run.runId}
                          criterion={c}
                          value={run.scores[c]}
                          editable={editable.has(c) && !data.qualifyingLocked}
                          maxA={m.a}
                          maxB={m.b}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
