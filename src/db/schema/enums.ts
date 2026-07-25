/** Postgres enums — mirror data_model.md. Names are snake_case in the DB. */
import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "judge", "secretary", "driver"]);

export const userStatusEnum = pgEnum("user_status", ["invited", "active"]);

export const eventStatusEnum = pgEnum("event_status", ["upcoming", "ongoing", "finished"]);

export const raceStatusEnum = pgEnum("race_status", [
  "registration",
  "qualifying",
  "cup",
  "finished",
]);

export const cupSizeEnum = pgEnum("cup_size", ["4", "8", "16", "32"]);

export const criterionEnum = pgEnum("criterion", ["line", "angle", "style"]);

export const officialDutyEnum = pgEnum("official_duty", ["line", "angle", "style", "battle"]);

export const runStatusEnum = pgEnum("run_status", ["pending", "complete"]);

export const leaderboardStatusEnum = pgEnum("leaderboard_status", [
  "in_progress",
  "unofficial",
  "official",
]);

export const battleRoundEnum = pgEnum("battle_round", [
  "top32",
  "top16",
  "quarterfinal",
  "semifinal",
  "final",
  "bronsefinal",
]);

export const battleStatusEnum = pgEnum("battle_status", ["pending", "omt", "decided", "bye"]);

export const advanceSlotEnum = pgEnum("advance_slot", ["a", "b"]);

export const cupStatusEnum = pgEnum("cup_status", ["pending", "in_progress", "finished"]);
