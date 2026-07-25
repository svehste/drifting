import { describe, expect, it } from "vitest";
import { isUuid } from "./validation";

describe("isUuid (driver route guard — 404 on bad UUID)", () => {
  it("accepts a well-formed UUID", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });

  it("rejects malformed ids so they never hit the DB", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("123")).toBe(false);
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c33")).toBe(false);
  });
});
