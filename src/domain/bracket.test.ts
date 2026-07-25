import { describe, expect, it } from "vitest";
import { buildBracket, type BuiltBattle } from "./bracket";
import type { RankedDriver } from "./ranking";
import type { CupSize } from "./types";

/** Minimal ranked drivers: driver id `s{seed}` at rank = seed. */
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

const byKey = (battles: BuiltBattle[]) => new Map(battles.map((b) => [b.key, b]));
const inRound = (battles: BuiltBattle[], round: string) =>
  battles.filter((b) => b.round === round).sort((a, b) => a.position - b.position);

describe("buildBracket — full field", () => {
  it("Top 8 first round pairs by seed and wires winner advancement", () => {
    const { battles } = buildBracket(ranked(8), 8);
    const qf = inRound(battles, "quarterfinal");
    expect(qf.map((b) => [b.driverA, b.driverB])).toEqual([
      ["s1", "s8"],
      ["s4", "s5"],
      ["s2", "s7"],
      ["s3", "s6"],
    ]);
    // qf0 & qf1 feed semifinal#0 (slots a,b); qf2 & qf3 feed semifinal#1.
    expect(qf[0].nextBattleKey).toBe("semifinal#0");
    expect(qf[0].nextSlot).toBe("a");
    expect(qf[1].nextBattleKey).toBe("semifinal#0");
    expect(qf[1].nextSlot).toBe("b");
    expect(qf[2].nextBattleKey).toBe("semifinal#1");
    expect(qf[3].nextSlot).toBe("b");
    // Everyone present → every first-round battle is a live pending battle.
    expect(qf.every((b) => b.status === "pending")).toBe(true);
  });

  it("bronsefinal is fed by the two semifinal losers (M1 DoD)", () => {
    const { battles } = buildBracket(ranked(8), 8);
    const semis = inRound(battles, "semifinal");
    expect(semis).toHaveLength(2);
    expect(semis[0].loserNextBattleKey).toBe("bronsefinal#0");
    expect(semis[0].loserNextSlot).toBe("a");
    expect(semis[1].loserNextBattleKey).toBe("bronsefinal#0");
    expect(semis[1].loserNextSlot).toBe("b");
    // The final does not feed a loser anywhere.
    expect(inRound(battles, "final")[0].loserNextBattleKey).toBeNull();
    // A bronsefinal node exists.
    expect(inRound(battles, "bronsefinal")).toHaveLength(1);
  });

  it("winner path: 1v32-style folding keeps seeds 1 and 2 apart until the final", () => {
    const { battles } = buildBracket(ranked(8), 8);
    const map = byKey(battles);
    // Seed 1 lives in quarterfinal#0 → semifinal#0(a) → final(a).
    // Seed 2 lives in quarterfinal#2 → semifinal#1(a) → final(b).
    expect(map.get("quarterfinal#0")!.driverA).toBe("s1");
    expect(map.get("quarterfinal#2")!.driverA).toBe("s2");
    expect(map.get("semifinal#0")!.nextBattleKey).toBe("final#0");
    expect(map.get("semifinal#0")!.nextSlot).toBe("a");
    expect(map.get("semifinal#1")!.nextSlot).toBe("b");
  });
});

describe("buildBracket — byes (Bracket seeding AC 6)", () => {
  it("Top 32 seeded with 16 drivers collapses its first round to byes (M1 DoD)", () => {
    const { battles } = buildBracket(ranked(16), 32);
    const top32 = inRound(battles, "top32");
    expect(top32).toHaveLength(16);
    // Every first-round battle is a bye with the present (lower) seed as winner.
    expect(top32.every((b) => b.status === "bye")).toBe(true);
    expect(top32.filter((b) => b.winner !== null)).toHaveLength(16);

    // The Top 16 round is now fully populated with two real drivers per battle.
    const top16 = inRound(battles, "top16");
    expect(top16).toHaveLength(8);
    expect(top16.every((b) => b.driverA !== null && b.driverB !== null)).toBe(true);
    expect(top16.every((b) => b.status === "pending")).toBe(true);

    // Classic 1 v 16 lands in top16#0 after the byes advance.
    expect(top16[0].driverA).toBe("s1");
    expect(top16[0].driverB).toBe("s16");
  });

  it("Top 8 with 5 drivers: byes for the top seeds, a live 4v5 battle", () => {
    const { battles } = buildBracket(ranked(5), 8);
    const qf = inRound(battles, "quarterfinal");
    // qf0: 1 v (empty 8) → bye; qf1: 4 v 5 → live; qf2: 2 v (7) bye; qf3: 3 v (6) bye.
    expect(qf[0].status).toBe("bye");
    expect(qf[0].winner).toBe("s1");
    expect(qf[1].status).toBe("pending");
    expect(qf[1].driverA).toBe("s4");
    expect(qf[1].driverB).toBe("s5");
    expect(qf[2].status).toBe("bye");
    expect(qf[3].status).toBe("bye");
    // semifinal#0 = s1 (bye) vs winner of (4v5) → one known driver, one unknown.
    const map = byKey(battles);
    expect(map.get("semifinal#0")!.driverA).toBe("s1");
    expect(map.get("semifinal#0")!.driverB).toBeNull();
    expect(map.get("semifinal#0")!.status).toBe("pending");
  });
});
