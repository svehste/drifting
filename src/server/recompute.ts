/**
 * Recompute cached qualifying values from raw scores, using the M1 pure
 * functions. Runs inside the same transaction as the score write so the caches
 * (run.total/approved, registration.qualifying_score/rank/eligible) never drift.
 */
import "server-only";
import { eq, inArray, sql, type SQL } from "drizzle-orm";
import { qualifyingRuns, registrations, runScores } from "@/db/schema";
import { rankDrivers, runTotal, type DriverRuns, type RunInput } from "@/domain";
import type { Tx } from "./audit";

/**
 * Recompute every run and the race ranking for a race. Small N (≤32×2 runs), so
 * doing the whole race on each score change keeps the logic simple and correct.
 */
export async function recomputeRace(tx: Tx, raceId: string): Promise<void> {
  const regs = await tx
    .select({ id: registrations.id })
    .from(registrations)
    .where(eq(registrations.raceId, raceId));
  if (regs.length === 0) return;
  const regIds = regs.map((r) => r.id);

  const runs = await tx
    .select()
    .from(qualifyingRuns)
    .where(inArray(qualifyingRuns.registrationId, regIds));
  const runIds = runs.map((r) => r.id);

  const scores =
    runIds.length > 0
      ? await tx.select().from(runScores).where(inArray(runScores.runId, runIds))
      : [];
  const scoresByRun = new Map<string, typeof scores>();
  for (const s of scores) {
    if (!scoresByRun.has(s.runId)) scoresByRun.set(s.runId, []);
    scoresByRun.get(s.runId)!.push(s);
  }

  // 1) Each run: complete iff all three criteria are confirmed; total from M1.
  // Collect the new row state in memory, then flush all runs in ONE statement —
  // a per-run UPDATE round-trip (×up to 64) over the pooler is what made scoring
  // feel slow. Same for the ranking updates below.
  const completeInputByReg = new Map<string, RunInput[]>();
  const runUpdates: { id: string; status: "pending" | "complete"; total: number | null; approved: boolean }[] = [];
  for (const run of runs) {
    const rs = scoresByRun.get(run.id) ?? [];
    const byCrit = new Map(rs.map((s) => [s.criterion, s]));
    const line = byCrit.get("line");
    const angle = byCrit.get("angle");
    const style = byCrit.get("style");
    const complete = Boolean(line?.confirmed && angle?.confirmed && style?.confirmed);

    let total: number | null = null;
    let approved = false;
    if (complete) {
      const input: RunInput = {
        line: line!.points ?? 0,
        angle: angle!.points ?? 0,
        flow: style!.flow ?? 0,
        effort: style!.effort ?? 0,
      };
      total = runTotal(input);
      approved = total > 0;
      if (!completeInputByReg.has(run.registrationId)) completeInputByReg.set(run.registrationId, []);
      completeInputByReg.get(run.registrationId)!.push(input);
    }

    runUpdates.push({ id: run.id, status: complete ? "complete" : "pending", total, approved });
  }

  if (runUpdates.length > 0) {
    const rows = sql.join(
      runUpdates.map(
        (u) => sql`(${u.id}::uuid, ${u.status}::run_status, ${u.total}::int, ${u.approved}::boolean)`,
      ),
      sql`, `,
    );
    await tx.execute(sql`
      UPDATE ${qualifyingRuns} AS q
      SET status = v.status, total = v.total, approved = v.approved
      FROM (VALUES ${rows}) AS v(id, status, total, approved)
      WHERE q.id = v.id
    `);
  }

  // 2) Race ranking with the HKS/LKS tie-break (M1 rankDrivers).
  const driverRuns: DriverRuns[] = regs.map((r) => ({
    driverId: r.id,
    runs: completeInputByReg.get(r.id) ?? [],
  }));
  const ranked = rankDrivers(driverRuns);

  if (ranked.length > 0) {
    const rows: SQL[] = ranked.map(
      (d) =>
        sql`(${d.driverId}::uuid, ${d.eligible ? d.qualifyingScore : null}::int, ${d.rank}::int, ${d.eligible}::boolean)`,
    );
    await tx.execute(sql`
      UPDATE ${registrations} AS r
      SET qualifying_score = v.qualifying_score, qualifying_rank = v.qualifying_rank, eligible = v.eligible
      FROM (VALUES ${sql.join(rows, sql`, `)}) AS v(id, qualifying_score, qualifying_rank, eligible)
      WHERE r.id = v.id
    `);
  }
}
