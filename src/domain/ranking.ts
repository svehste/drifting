/**
 * Ranking [rangering] with the exact HKS/LKS tie-break (Qualifying AC 8, §10).
 * Pure: takes each driver's runs, returns a total ordering.
 */
import { bestRun, isApproved, type RunBreakdown, type RunInput } from "./scoring";

/** A driver and their qualifying runs (0, 1, or 2 runs). */
export interface DriverRuns {
  driverId: string;
  runs: RunInput[];
}

export interface RankedDriver {
  driverId: string;
  /** 1-based rank among eligible drivers; null when not eligible (no approved run). */
  rank: number | null;
  /** Qualifying score = HKS total (Qualifying AC 7). */
  qualifyingScore: number;
  hks: RunBreakdown;
  lks: RunBreakdown;
  /** Has ≥1 approved run (total > 0) → may be seeded into the bracket. */
  eligible: boolean;
}

/**
 * Tie-break order (Qualifying AC 8), all comparisons highest-first:
 *   1 HKS total  2 LKS total
 *   3 HKS line   4 HKS angle   5 HKS style
 *   6 LKS line   7 LKS angle   8 LKS style
 * Returns <0 if a should rank ahead of b.
 */
function compareByTieBreak(a: RankedDriver, b: RankedDriver): number {
  const keys: Array<[number, number]> = [
    [a.hks.total, b.hks.total],
    [a.lks.total, b.lks.total],
    [a.hks.line, b.hks.line],
    [a.hks.angle, b.hks.angle],
    [a.hks.style, b.hks.style],
    [a.lks.line, b.lks.line],
    [a.lks.angle, b.lks.angle],
    [a.lks.style, b.lks.style],
  ];
  for (const [x, y] of keys) {
    if (x !== y) return y - x; // higher first
  }
  // Fully tied on every criterion: order deterministically by id so the result
  // is stable regardless of input order.
  return a.driverId < b.driverId ? -1 : a.driverId > b.driverId ? 1 : 0;
}

/**
 * Rank drivers by qualifying result. Eligible drivers (≥1 approved run) come
 * first, ordered by the tie-break, with ranks 1..k. Ineligible drivers follow
 * with rank = null (they cannot be seeded — Qualifying AC 12). Deterministic.
 */
export function rankDrivers(drivers: DriverRuns[]): RankedDriver[] {
  const computed: RankedDriver[] = drivers.map((d) => {
    const { hks, lks } = bestRun(d.runs);
    const eligible = isApproved(hks.total);
    return {
      driverId: d.driverId,
      rank: null,
      qualifyingScore: hks.total,
      hks,
      lks,
      eligible,
    };
  });

  const eligible = computed
    .filter((d) => d.eligible)
    .sort(compareByTieBreak)
    .map((d, i) => ({ ...d, rank: i + 1 }));

  const ineligible = computed
    .filter((d) => !d.eligible)
    .sort((a, b) => (a.driverId < b.driverId ? -1 : a.driverId > b.driverId ? 1 : 0));

  return [...eligible, ...ineligible];
}
