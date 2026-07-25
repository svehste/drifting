/**
 * Drizzle tables — the data model as real Postgres tables (data_model.md).
 * Unique constraints and FK behaviour follow the "Key constraints & rules"
 * section. All timestamps are timestamptz.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  advanceSlotEnum,
  battleRoundEnum,
  battleStatusEnum,
  criterionEnum,
  cupSizeEnum,
  cupStatusEnum,
  eventStatusEnum,
  leaderboardStatusEnum,
  officialDutyEnum,
  raceStatusEnum,
  roleEnum,
  runStatusEnum,
  userStatusEnum,
} from "./enums";

/** Shared audit timestamps present on (almost) every table. */
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// 1. User [Bruker] — single table for all people; role(s) decide access.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  // Passwords are handled by Supabase Auth (tech_stack: don't roll your own auth).
  // This links a staff user to their auth.users row; null for driver-only users.
  authUserId: uuid("auth_user_id").unique(),
  startNumber: text("start_number"),
  startNumberIsDummy: boolean("start_number_is_dummy").notNull().default(false),
  club: text("club"),
  car: text("car"),
  status: userStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

// 2. UserRole [Brukerrolle] — many-to-many; PK (user_id, role).
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.role] }),
  }),
);

// 3. Event [Arrangement].
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: eventStatusEnum("status").notNull().default("upcoming"),
  ...timestamps,
});

// 4. EventStaff [Arrangementsstab] — PK (event_id, user_id).
export const eventStaff = pgTable(
  "event_staff",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamps.createdAt,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.eventId, t.userId] }),
  }),
);

// 5. Class [Klasse] — shared global lookup; name unique.
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order"),
  ...timestamps,
});

// 6. Race [Løp].
export const races = pgTable("races", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Deletion of a class is blocked while races reference it (Races AC 9).
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "restrict" }),
  cupSize: cupSizeEnum("cup_size").notNull(),
  maxLine: integer("max_line").notNull().default(40),
  maxAngle: integer("max_angle").notNull().default(30),
  maxStyleFlow: integer("max_style_flow").notNull().default(15),
  maxStyleEffort: integer("max_style_effort").notNull().default(15),
  status: raceStatusEnum("status").notNull().default("registration"),
  qualifyingLocked: boolean("qualifying_locked").notNull().default(false),
  leaderboardStatus: leaderboardStatusEnum("leaderboard_status")
    .notNull()
    .default("in_progress"),
  ...timestamps,
});

// 7. RaceOfficial [Løpsdommer] — one judge per criterion; many battle judges.
export const raceOfficials = pgTable(
  "race_officials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    raceId: uuid("race_id")
      .notNull()
      .references(() => races.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    duty: officialDutyEnum("duty").notNull(),
    ...timestamps,
  },
  (t) => ({
    // Exactly one judge per criterion (line/angle/style); battle duty is exempt.
    oneJudgePerCriterion: uniqueIndex("race_officials_one_per_criterion")
      .on(t.raceId, t.duty)
      .where(sql`${t.duty} <> 'battle'`),
    // No duplicate (race, user, duty) rows.
    noDuplicate: uniqueIndex("race_officials_no_duplicate").on(t.raceId, t.userId, t.duty),
  }),
);

// 8. Registration [Påmelding] — a driver entered in a race; unique (race, user).
export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    raceId: uuid("race_id")
      .notNull()
      .references(() => races.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    qualifyingScore: integer("qualifying_score"),
    qualifyingRank: integer("qualifying_rank"),
    seed: integer("seed"),
    eligible: boolean("eligible").notNull().default(false),
    finalPlace: integer("final_place"),
    ...timestamps,
  },
  (t) => ({
    uniqueEntry: uniqueIndex("registrations_race_user").on(t.raceId, t.userId),
  }),
);

// 9. QualifyingRun [Kvalifiseringsrunde] — unique (registration, run_number).
export const qualifyingRuns = pgTable(
  "qualifying_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    runNumber: integer("run_number").notNull(),
    status: runStatusEnum("status").notNull().default("pending"),
    total: integer("total"),
    approved: boolean("approved").notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    uniqueRun: uniqueIndex("qualifying_runs_reg_number").on(t.registrationId, t.runNumber),
  }),
);

// 10. RunScore [Poeng] — one row per (run, criterion).
export const runScores = pgTable(
  "run_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => qualifyingRuns.id, { onDelete: "cascade" }),
    criterion: criterionEnum("criterion").notNull(),
    judgeUserId: uuid("judge_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    points: integer("points"), // line/angle
    flow: integer("flow"), // style
    effort: integer("effort"), // style
    confirmed: boolean("confirmed").notNull().default(false),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    uniqueScore: uniqueIndex("run_scores_run_criterion").on(t.runId, t.criterion),
  }),
);

// 11. Cup [Cup] — one per race.
export const cups = pgTable("cups", {
  id: uuid("id").primaryKey().defaultRandom(),
  raceId: uuid("race_id")
    .notNull()
    .unique()
    .references(() => races.id, { onDelete: "cascade" }),
  size: cupSizeEnum("size").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  regenerations: integer("regenerations").notNull().default(0),
  status: cupStatusEnum("status").notNull().default("pending"),
  ...timestamps,
});

// 12. Battle [Battle / Tvekamp] — a node in the fixed bracket tree.
export const battles = pgTable(
  "battles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cupId: uuid("cup_id")
      .notNull()
      .references(() => cups.id, { onDelete: "cascade" }),
    round: battleRoundEnum("round").notNull(),
    position: integer("position").notNull(),
    driverARegistrationId: uuid("driver_a_registration_id").references(() => registrations.id, {
      onDelete: "set null",
    }),
    driverBRegistrationId: uuid("driver_b_registration_id").references(() => registrations.id, {
      onDelete: "set null",
    }),
    winnerRegistrationId: uuid("winner_registration_id").references(() => registrations.id, {
      onDelete: "set null",
    }),
    omtCount: integer("omt_count").notNull().default(0),
    status: battleStatusEnum("status").notNull().default("pending"),
    nextBattleId: uuid("next_battle_id").references((): AnyPgColumn => battles.id, {
      onDelete: "set null",
    }),
    nextSlot: advanceSlotEnum("next_slot"),
    loserNextBattleId: uuid("loser_next_battle_id").references((): AnyPgColumn => battles.id, {
      onDelete: "set null",
    }),
    loserNextSlot: advanceSlotEnum("loser_next_slot"),
    ...timestamps,
  },
  (t) => ({
    uniqueSlot: uniqueIndex("battles_cup_round_position").on(t.cupId, t.round, t.position),
  }),
);

// 13. AuditLog [Logg] — append-only; only a created_at timestamp.
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
