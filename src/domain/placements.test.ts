import { describe, expect, it } from "vitest";
import { buildBracket, type BuiltBattle } from "./bracket";
import { finalPlacements } from "./placements";
import type { RankedDriver } from "./ranking";
import { roundsForSize } from "./seeding";
import type { CupSize } from "./types";

function ranked(n: number): RankedDriver[] {
  return Array.from({ length: n }, (_, i) => ({
    driverId: `s${i + 1}`,
    rank: i + 1,
    qualifyingScore: 1000 - i,
    hks: { total: 1000 - i, line: 0, angle: 0, style: 0 },
    lks: { total: 0, line: 0, angle: 0, style: 0 },
    eligible: true,
  }));
}

const seedOf = (id: string) => Number(id.slice(1));

/**
 * Play out a bracket by advancing the winner (and semifinal loser) along the
 * fixed tree — exercises the same wiring M6 will use at runtime. `pickWinner`
 * defaults to "the better (lower) seed always wins".
 */
function resolve(
  battles: BuiltBattle[],
  size: CupSize,
  pickWinner: (a: string, b: string) => string = (a, b) => (seedOf(a) < seedOf(b) ? a : b),
): BuiltBattle[] {
  const map = new Map(battles.map((b) => [b.key, b]));
  const put = (k: string, slot: "a" | "b", id: string) => {
    const t = map.get(k)!;
    if (slot === "a") t.driverA = id;
    else t.driverB = id;
  };

  const decide = (b: BuiltBattle) => {
    if (b.status === "bye" || !b.driverA || !b.driverB) return;
    const winner = pickWinner(b.driverA, b.driverB);
    const loser = winner === b.driverA ? b.driverB : b.driverA;
    b.winner = winner;
    b.status = "decided";
    if (b.nextBattleKey && b.nextSlot) put(b.nextBattleKey, b.nextSlot, winner);
    if (b.loserNextBattleKey && b.loserNextSlot) put(b.loserNextBattleKey, b.loserNextSlot, loser);
  };

  for (const round of roundsForSize(size)) {
    battles.filter((b) => b.round === round).sort((a, b) => a.position - b.position).forEach(decide);
  }
  decide(map.get("bronsefinal#0")!);
  return [...map.values()];
}

describe("finalPlacements (Cup AC 11)", () => {
  it("full Top 8, lower seed always wins → places 1..8 by seed", () => {
    const built = buildBracket(ranked(8), 8);
    const resolved = resolve(built.battles, 8);
    const places = finalPlacements(resolved, seedOf);
    expect(places).toEqual([
      { driverId: "s1", place: 1 },
      { driverId: "s2", place: 2 },
      { driverId: "s3", place: 3 },
      { driverId: "s4", place: 4 },
      { driverId: "s5", place: 5 },
      { driverId: "s6", place: 6 },
      { driverId: "s7", place: 7 },
      { driverId: "s8", place: 8 },
    ]);
  });

  it("Top 4: winner/runner-up from final, 3rd/4th from bronsefinal", () => {
    const built = buildBracket(ranked(4), 4);
    const resolved = resolve(built.battles, 4);
    const places = finalPlacements(resolved, seedOf);
    // Semifinals: s1 v s4 → s1 (loser s4); s2 v s3 → s2 (loser s3).
    // Final s1 v s2 → s1. Bronse s4 v s3 → s3.
    expect(places).toEqual([
      { driverId: "s1", place: 1 },
      { driverId: "s2", place: 2 },
      { driverId: "s3", place: 3 },
      { driverId: "s4", place: 4 },
    ]);
  });

  it("an upset in the bronsefinal swaps 3rd and 4th", () => {
    const built = buildBracket(ranked(4), 4);
    // Lower seed wins everywhere except the bronsefinal, where the underdog wins.
    const resolved = resolve(built.battles, 4, (a, b) => (seedOf(a) < seedOf(b) ? a : b));
    // Manually flip the bronsefinal outcome.
    const bronse = resolved.find((x) => x.round === "bronsefinal")!;
    const other = bronse.winner === bronse.driverA ? bronse.driverB! : bronse.driverA!;
    bronse.winner = other;
    const places = finalPlacements(resolved, seedOf);
    const place = (id: string) => places.find((p) => p.driverId === id)!.place;
    expect(place("s1")).toBe(1);
    expect(place("s2")).toBe(2);
    expect(place("s4")).toBe(3); // underdog took bronze
    expect(place("s3")).toBe(4);
  });

  it("Top 16, lower seed always wins → places 1..16 by seed", () => {
    const built = buildBracket(ranked(16), 16);
    const resolved = resolve(built.battles, 16);
    const places = finalPlacements(resolved, seedOf);
    expect(places.map((p) => p.driverId)).toEqual(
      Array.from({ length: 16 }, (_, i) => `s${i + 1}`),
    );
    expect(places.map((p) => p.place)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});
