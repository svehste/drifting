/**
 * Recompute cached qualifying values from raw scores, using the M1 pure
 * functions. Runs inside the same transaction as the score write so the caches
 * (run.total/approved, registration.qualifying_score/rank/eligible) never drift.
 */
import "server-only";
import { eq, inArray } from "drizzle-orm";
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
  const completeInputByReg = new Map<string, RunInput[]>();
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

    await tx
      .update(qualifyingRuns)
      .set({ status: complete ? "complete" : "pending", total, approved })
      .where(eq(qualifyingRuns.id, run.id));
  }

  // 2) Race ranking with the HKS/LKS tie-break (M1 rankDrivers).
  const driverRuns: DriverRuns[] = regs.map((r) => ({
    driverId: r.id,
    runs: completeInputByReg.get(r.id) ?? [],
  }));
  const ranked = rankDrivers(driverRuns);

  for (const d of ranked) {
    await tx
      .update(registrations)
      .set({
        qualifyingScore: d.eligible ? d.qualifyingScore : null,
        qualifyingRank: d.rank,
        eligible: d.eligible,
      })
      .where(eq(registrations.id, d.driverId));
  }
}
