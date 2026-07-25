import { describe, expect, it } from "vitest";
import { can, capabilitiesFor, type Capability } from "./permissions";
import type { Role } from "./types";

describe("permission matrix (Roles & permissions)", () => {
  it("admin can do everything", () => {
    const all: Capability[] = [
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
    for (const cap of all) expect(can(["admin"], cap)).toBe(true);
  });

  it("secretary restrictions (Decisions log 5)", () => {
    // Allowed
    expect(can(["secretary"], "events.edit")).toBe(true);
    expect(can(["secretary"], "races.manage")).toBe(true);
    expect(can(["secretary"], "drivers.manage")).toBe(true);
    expect(can(["secretary"], "users.manageNonAdmin")).toBe(true);
    expect(can(["secretary"], "leaderboard.publish")).toBe(true);
    expect(can(["secretary"], "qualifying.lock")).toBe(true);
    // Forbidden
    expect(can(["secretary"], "scores.enter")).toBe(false);
    expect(can(["secretary"], "events.create")).toBe(false);
    expect(can(["secretary"], "users.manageAdmin")).toBe(false);
    expect(can(["secretary"], "qualifying.unlock")).toBe(false);
    expect(can(["secretary"], "battle.decide")).toBe(false);
    expect(can(["secretary"], "auditLog.view")).toBe(false);
  });

  it("judge can score and decide battles, nothing else", () => {
    expect(can(["judge"], "scores.enter")).toBe(true);
    expect(can(["judge"], "battle.decide")).toBe(true);
    expect(can(["judge"], "races.manage")).toBe(false);
    expect(can(["judge"], "leaderboard.publish")).toBe(false);
  });

  it("driver has no privileged capability", () => {
    expect(capabilitiesFor(["driver"]).size).toBe(0);
  });

  it("multi-role access is the union of rights (AC 3)", () => {
    const roles: Role[] = ["secretary", "judge"];
    // secretary can't score; judge can → union can.
    expect(can(roles, "scores.enter")).toBe(true);
    // judge can't manage races; secretary can → union can.
    expect(can(roles, "races.manage")).toBe(true);
    // neither can grant admin.
    expect(can(roles, "users.manageAdmin")).toBe(false);
  });

  it("no roles → no capabilities", () => {
    expect(can([], "events.edit")).toBe(false);
  });
});
