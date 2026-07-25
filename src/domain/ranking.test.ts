import { describe, expect, it } from "vitest";
import { rankDrivers, type DriverRuns } from "./ranking";
import type { RunInput } from "./scoring";

/** Build a driver whose two runs are the given high and low run. */
function driver(id: string, high: RunInput, low: RunInput): DriverRuns {
  return { driverId: id, runs: [high, low] };
}

/** A run with a given (line, angle, style) where style is split flow/effort. */
function run(line: number, angle: number, style: number): RunInput {
  return { line, angle, flow: style, effort: 0 };
}

describe("rankDrivers tie-break (Qualifying AC 8)", () => {
  it("level 1 — highest qualifying score (HKS total) wins", () => {
    const r = rankDrivers([
      driver("a", run(30, 20, 10), run(0, 0, 0)), // HKS 60
      driver("b", run(40, 30, 20), run(0, 0, 0)), // HKS 90
    ]);
    expect(r.map((d) => d.driverId)).toEqual(["b", "a"]);
    expect(r[0].rank).toBe(1);
    expect(r[1].rank).toBe(2);
  });

  it("level 2 — equal HKS, higher LKS total wins", () => {
    const r = rankDrivers([
      driver("a", run(50, 0, 0), run(30, 0, 0)), // HKS 50, LKS 30
      driver("b", run(50, 0, 0), run(40, 0, 0)), // HKS 50, LKS 40
    ]);
    expect(r.map((d) => d.driverId)).toEqual(["b", "a"]);
  });

  it("level 3 — equal HKS+LKS totals, higher HKS line wins", () => {
    const r = rankDrivers([
      driver("a", run(40, 30, 30), run(10, 0, 0)), // HKS total 100, line 40
      driver("b", run(30, 40, 30), run(10, 0, 0)), // HKS total 100, line 30
    ]);
    expect(r.map((d) => d.driverId)).toEqual(["a", "b"]);
  });

  it("level 4 — equal down to HKS line, higher HKS angle wins", () => {
    const r = rankDrivers([
      driver("a", run(10, 30, 60), run(5, 0, 0)), // total 100, line 10, angle 30
      driver("b", run(10, 20, 70), run(5, 0, 0)), // total 100, line 10, angle 20
    ]);
    expect(r.map((d) => d.driverId)).toEqual(["a", "b"]);
  });

  it("level 6 — equal HKS, higher LKS line wins", () => {
    const r = rankDrivers([
      driver("a", run(20, 20, 20), run(30, 10, 10)), // LKS total 50, line 30
      driver("b", run(20, 20, 20), run(20, 20, 10)), // LKS total 50, line 20
    ]);
    expect(r.map((d) => d.driverId)).toEqual(["a", "b"]);
  });

  it("level 7 — equal down to LKS line, higher LKS angle wins", () => {
    const r = rankDrivers([
      driver("a", run(20, 20, 20), run(10, 30, 10)), // LKS total 50, line 10, angle 30
      driver("b", run(20, 20, 20), run(10, 20, 20)), // LKS total 50, line 10, angle 20
    ]);
    expect(r.map((d) => d.driverId)).toEqual(["a", "b"]);
  });

  it("fully tied → deterministic order by id (stable regardless of input order)", () => {
    const same = (): [RunInput, RunInput] => [run(20, 10, 10), run(15, 5, 5)];
    const forward = rankDrivers([driver("y", ...same()), driver("x", ...same())]);
    const reverse = rankDrivers([driver("x", ...same()), driver("y", ...same())]);
    expect(forward.map((d) => d.driverId)).toEqual(["x", "y"]);
    expect(reverse.map((d) => d.driverId)).toEqual(["x", "y"]);
  });
});

describe("rankDrivers eligibility (Qualifying AC 6, 12)", () => {
  it("drivers with no approved run are ineligible, unranked, and sort last", () => {
    const r = rankDrivers([
      driver("zero", run(0, 0, 0), run(0, 0, 0)), // all zero → ineligible
      driver("real", run(10, 0, 0), run(0, 0, 0)), // one approved run
    ]);
    const real = r.find((d) => d.driverId === "real")!;
    const zero = r.find((d) => d.driverId === "zero")!;
    expect(real.eligible).toBe(true);
    expect(real.rank).toBe(1);
    expect(zero.eligible).toBe(false);
    expect(zero.rank).toBeNull();
    expect(r[r.length - 1].driverId).toBe("zero");
  });

  it("assigns contiguous ranks 1..k to eligible drivers", () => {
    const r = rankDrivers([
      driver("a", run(90, 0, 0), run(0, 0, 0)),
      driver("b", run(80, 0, 0), run(0, 0, 0)),
      driver("c", run(70, 0, 0), run(0, 0, 0)),
    ]);
    expect(r.map((d) => d.rank)).toEqual([1, 2, 3]);
    expect(r.map((d) => d.driverId)).toEqual(["a", "b", "c"]);
  });
});
