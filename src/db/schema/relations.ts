/** Drizzle relations — enable the `db.query.*` relational API used in later milestones. */
import { relations } from "drizzle-orm";
import {
  auditLogs,
  battles,
  classes,
  cups,
  eventStaff,
  events,
  qualifyingRuns,
  raceOfficials,
  races,
  registrations,
  runScores,
  userRoles,
  users,
} from "./tables";

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
  registrations: many(registrations),
  eventStaff: many(eventStaff),
  raceOfficials: many(raceOfficials),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  races: many(races),
  staff: many(eventStaff),
}));

export const eventStaffRelations = relations(eventStaff, ({ one }) => ({
  event: one(events, { fields: [eventStaff.eventId], references: [events.id] }),
  user: one(users, { fields: [eventStaff.userId], references: [users.id] }),
}));

export const classesRelations = relations(classes, ({ many }) => ({
  races: many(races),
}));

export const racesRelations = relations(races, ({ one, many }) => ({
  event: one(events, { fields: [races.eventId], references: [events.id] }),
  class: one(classes, { fields: [races.classId], references: [classes.id] }),
  officials: many(raceOfficials),
  registrations: many(registrations),
  cup: one(cups),
}));

export const raceOfficialsRelations = relations(raceOfficials, ({ one }) => ({
  race: one(races, { fields: [raceOfficials.raceId], references: [races.id] }),
  user: one(users, { fields: [raceOfficials.userId], references: [users.id] }),
}));

export const registrationsRelations = relations(registrations, ({ one, many }) => ({
  race: one(races, { fields: [registrations.raceId], references: [races.id] }),
  driver: one(users, { fields: [registrations.userId], references: [users.id] }),
  runs: many(qualifyingRuns),
}));

export const qualifyingRunsRelations = relations(qualifyingRuns, ({ one, many }) => ({
  registration: one(registrations, {
    fields: [qualifyingRuns.registrationId],
    references: [registrations.id],
  }),
  scores: many(runScores),
}));

export const runScoresRelations = relations(runScores, ({ one }) => ({
  run: one(qualifyingRuns, { fields: [runScores.runId], references: [qualifyingRuns.id] }),
  judge: one(users, { fields: [runScores.judgeUserId], references: [users.id] }),
}));

export const cupsRelations = relations(cups, ({ one, many }) => ({
  race: one(races, { fields: [cups.raceId], references: [races.id] }),
  battles: many(battles),
}));

export const battlesRelations = relations(battles, ({ one }) => ({
  cup: one(cups, { fields: [battles.cupId], references: [cups.id] }),
  driverA: one(registrations, {
    fields: [battles.driverARegistrationId],
    references: [registrations.id],
    relationName: "driverA",
  }),
  driverB: one(registrations, {
    fields: [battles.driverBRegistrationId],
    references: [registrations.id],
    relationName: "driverB",
  }),
  winner: one(registrations, {
    fields: [battles.winnerRegistrationId],
    references: [registrations.id],
    relationName: "winner",
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorUserId], references: [users.id] }),
}));
