/**
 * Scoring [poeng] — pure functions over a qualifying run's criterion scores.
 * NM defaults: line 0–40, angle 0–30, style = flow 0–15 + effort 0–15.
 * Maxima are configurable per race but that is a validation concern; these
 * functions just sum whatever they are given.
 */

/** The raw scores that make up one qualifying run [kvalifiseringsrunde]. */
export interface RunInput {
  line: number;
  angle: number;
  flow: number;
  effort: number;
}

/** A run's score, broken down for tie-breaking (style = flow + effort). */
export interface RunBreakdown {
  total: number;
  line: number;
  angle: number;
  style: number;
}

const ZERO: RunBreakdown = { total: 0, line: 0, angle: 0, style: 0 };

/** Style [stil] score = flow [flyt] + effort [innsats]. */
export function styleTotal(run: RunInput): number {
  return run.flow + run.effort;
}

/** A run's total score = line + angle + style (Qualifying AC 4). No averaging. */
export function runTotal(run: RunInput): number {
  return run.line + run.angle + styleTotal(run);
}

/** Approved [godkjent] ⇔ total > 0 (Qualifying AC 6). */
export function isApproved(total: number): boolean {
  return total > 0;
}

/** Expand a run into its tie-break breakdown. */
export function breakdown(run: RunInput): RunBreakdown {
  return {
    total: runTotal(run),
    line: run.line,
    angle: run.angle,
    style: styleTotal(run),
  };
}

/**
 * From a driver's runs, pick the high (HKS) and low (LKS) scores.
 * HKS [høyeste kvalifiseringsscore] = best run's score (the qualifying score).
 * LKS [laveste kvalifiseringsscore] = the other run, kept for tie-breaking
 * (Qualifying AC 7). Missing runs count as a zero breakdown.
 */
export function bestRun(runs: RunInput[]): { hks: RunBreakdown; lks: RunBreakdown } {
  const sorted = runs.map(breakdown).sort((a, b) => b.total - a.total);
  return {
    hks: sorted[0] ?? ZERO,
    lks: sorted[1] ?? ZERO,
  };
}
