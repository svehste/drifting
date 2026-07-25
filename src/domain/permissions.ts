/**
 * The authorization matrix (Roles & permissions) as pure, testable logic.
 * `can(roles, capability)` is the single source of truth for what a set of
 * roles may do; the server binds it to the request in src/server/authz.ts.
 * Access is the UNION of every role a user holds (Roles & permissions AC 3).
 */
import type { Role } from "./types";

/** Every privileged capability in the app. */
export type Capability =
  | "events.create" // create/delete events
  | "events.edit" // edit event details
  | "races.manage" // create/edit/delete races
  | "raceOfficials.assign" // assign judges/secretaries to a race
  | "users.manageNonAdmin" // create/edit/invite non-admin users
  | "users.manageAdmin" // create admin users / grant admin role
  | "drivers.manage" // register/edit/delete drivers
  | "scores.enter" // enter/edit qualifying scores (own criterion — enforced separately)
  | "leaderboard.publish" // publish leaderboard as official
  | "qualifying.lock" // lock qualifying / generate bracket
  | "qualifying.unlock" // unlock qualifying / regenerate bracket (destructive)
  | "battle.decide" // decide battle winner / OMT
  | "auditLog.view"; // view the audit log

const ADMIN: Capability[] = [
  "events.create",
  "events.edit",
  "races.manage",
  "raceOfficials.assign",
  "users.manageNonAdmin",
  "users.manageAdmin",
  "drivers.manage",
  "scores.enter",
  "leaderboard.publish",
  "qualifying.lock",
  "qualifying.unlock",
  "battle.decide",
  "auditLog.view",
];

// Secretary: everything an admin can EXCEPT entering scores, creating/deleting
// events, creating admins / granting admin, unlocking/regenerating, and deciding
// battles (Roles & permissions; Decisions log 5).
const SECRETARY: Capability[] = [
  "events.edit",
  "races.manage",
  "raceOfficials.assign",
  "users.manageNonAdmin",
  "drivers.manage",
  "leaderboard.publish",
  "qualifying.lock",
];

// Judge: score their own criterion and decide battle outcomes.
const JUDGE: Capability[] = ["scores.enter", "battle.decide"];

// Driver: no privileged capabilities (their own page is a public UUID route).
const DRIVER: Capability[] = [];

export const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  admin: new Set(ADMIN),
  secretary: new Set(SECRETARY),
  judge: new Set(JUDGE),
  driver: new Set(DRIVER),
};

/** True if any of the user's roles grants the capability (union of rights). */
export function can(roles: Iterable<Role>, capability: Capability): boolean {
  for (const role of roles) {
    if (ROLE_CAPABILITIES[role]?.has(capability)) return true;
  }
  return false;
}

/** All capabilities available to a set of roles (their union). */
export function capabilitiesFor(roles: Iterable<Role>): Set<Capability> {
  const out = new Set<Capability>();
  for (const role of roles) {
    for (const cap of ROLE_CAPABILITIES[role] ?? []) out.add(cap);
  }
  return out;
}
