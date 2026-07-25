/**
 * Domain types & enums — mirrors data_model.md. Pure: no DB or framework imports.
 * These are the vocabulary the pure algorithms (scoring, ranking, seeding,
 * bracket, placements) speak in.
 */

export type Role = "admin" | "judge" | "secretary" | "driver";

export type EventStatus = "upcoming" | "ongoing" | "finished";

export type RaceStatus = "registration" | "qualifying" | "cup" | "finished";

/** Bracket size a race runs (drivers in the cup). */
export type CupSize = 4 | 8 | 16 | 32;
export const CUP_SIZES: readonly CupSize[] = [4, 8, 16, 32] as const;

export type Criterion = "line" | "angle" | "style";

export type OfficialDuty = "line" | "angle" | "style" | "battle";

export type RunStatus = "pending" | "complete";

export type LeaderboardStatus = "in_progress" | "unofficial" | "official";

/**
 * Named rounds along the winner path, plus the 3rd-place battle.
 * A cup's first round depends on its size (see firstRoundName).
 */
export type BattleRound =
  | "top32"
  | "top16"
  | "quarterfinal"
  | "semifinal"
  | "final"
  | "bronsefinal";

export type BattleStatus = "pending" | "omt" | "decided" | "bye";

/** Which slot (A or B) a driver fills when advancing. */
export type AdvanceSlot = "a" | "b";
