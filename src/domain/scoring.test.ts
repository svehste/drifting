import { describe, expect, it } from "vitest";
import { bestRun, isApproved, runTotal, styleTotal } from "./scoring";

describe("scoring", () => {
  it("runTotal = line + angle + flow + effort", () => {
    expect(runTotal({ line: 40, angle: 30, flow: 15, effort: 15 })).toBe(100);
    expect(runTotal({ line: 0, angle: 0, flow: 0, effort: 0 })).toBe(0);
    expect(runTotal({ line: 12, angle: 9, flow: 7, effort: 3 })).toBe(31);
  });

  it("styleTotal = flow + effort", () => {
    expect(styleTotal({ line: 0, angle: 0, flow: 8, effort: 6 })).toBe(14);
  });

  it("isApproved iff total > 0", () => {
    expect(isApproved(1)).toBe(true);
    expect(isApproved(0)).toBe(false);
    expect(isApproved(-1)).toBe(false);
  });

  it("bestRun picks HKS as highest total and keeps LKS for tie-break", () => {
    const { hks, lks } = bestRun([
      { line: 10, angle: 10, flow: 5, effort: 5 }, // total 30
      { line: 40, angle: 30, flow: 15, effort: 15 }, // total 100
    ]);
    expect(hks.total).toBe(100);
    expect(lks.total).toBe(30);
    expect(hks.style).toBe(30);
  });

  it("bestRun treats missing runs as zero breakdowns", () => {
    const none = bestRun([]);
    expect(none.hks.total).toBe(0);
    expect(none.lks.total).toBe(0);

    const one = bestRun([{ line: 5, angle: 5, flow: 0, effort: 0 }]);
    expect(one.hks.total).toBe(10);
    expect(one.lks.total).toBe(0);
  });
});
