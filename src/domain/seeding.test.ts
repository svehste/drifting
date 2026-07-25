import { describe, expect, it } from "vitest";
import { firstRoundName, roundsForSize, seedingOrder } from "./seeding";
import { CUP_SIZES } from "./types";

describe("seedingOrder (Bracket seeding AC 3)", () => {
  it("Top 4 → 1-4 2-3", () => {
    expect(seedingOrder(4)).toEqual([1, 4, 2, 3]);
  });

  it("Top 8 → 1-8 4-5 2-7 3-6", () => {
    expect(seedingOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("Top 16 matches the spec table exactly", () => {
    // (1-16)(8-9)(4-13)(5-12)(2-15)(7-10)(3-14)(6-11)
    expect(seedingOrder(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
  });

  it("Top 32 matches the spec table exactly", () => {
    // (1-32)(16-17)(8-25)(9-24)(4-29)(13-20)(5-28)(12-21)
    // (2-31)(15-18)(7-26)(10-23)(3-30)(14-19)(6-27)(11-22)
    expect(seedingOrder(32)).toEqual([
      1, 32, 16, 17, 8, 25, 9, 24, 4, 29, 13, 20, 5, 28, 12, 21, 2, 31, 15, 18, 7, 26, 10, 23, 3,
      30, 14, 19, 6, 27, 11, 22,
    ]);
  });

  it("every first-round pair sums to size + 1 (AC 4)", () => {
    for (const size of CUP_SIZES) {
      const order = seedingOrder(size);
      for (let i = 0; i < order.length; i += 2) {
        expect(order[i] + order[i + 1]).toBe(size + 1);
      }
    }
  });

  it("is a permutation of 1..size", () => {
    for (const size of CUP_SIZES) {
      const order = [...seedingOrder(size)].sort((a, b) => a - b);
      expect(order).toEqual(Array.from({ length: size }, (_, i) => i + 1));
    }
  });
});

describe("round structure", () => {
  it("winner-path rounds per cup size", () => {
    expect(roundsForSize(4)).toEqual(["semifinal", "final"]);
    expect(roundsForSize(8)).toEqual(["quarterfinal", "semifinal", "final"]);
    expect(roundsForSize(16)).toEqual(["top16", "quarterfinal", "semifinal", "final"]);
    expect(roundsForSize(32)).toEqual([
      "top32",
      "top16",
      "quarterfinal",
      "semifinal",
      "final",
    ]);
  });

  it("first round name", () => {
    expect(firstRoundName(4)).toBe("semifinal");
    expect(firstRoundName(8)).toBe("quarterfinal");
    expect(firstRoundName(16)).toBe("top16");
    expect(firstRoundName(32)).toBe("top32");
  });
});
