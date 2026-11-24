import { describe, expect, it } from "vitest";
import { COUNT_MS, countValue } from "./motion";

describe("count-up easing", () => {
  it("runs inside the 150 to 250ms range", () => {
    expect(COUNT_MS).toBeGreaterThanOrEqual(150);
    expect(COUNT_MS).toBeLessThanOrEqual(250);
  });
  it("starts at the origin and lands exactly on the target", () => {
    expect(countValue(0, 808.5, 0, COUNT_MS)).toBe(0);
    expect(countValue(0, 808.5, COUNT_MS, COUNT_MS)).toBe(808.5);
    expect(countValue(0, 808.5, COUNT_MS * 3, COUNT_MS)).toBe(808.5);
  });
  it("eases out: more than half the distance in the first half of the time", () => {
    expect(countValue(0, 100, COUNT_MS / 2, COUNT_MS)).toBeGreaterThan(50);
  });
  it("never overshoots, so nothing bounces", () => {
    for (const [a, b] of [[0, 808.5], [808.5, 824.67], [500, -60]] as const) {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      for (let t = 0; t <= COUNT_MS; t += 10) {
        const v = countValue(a, b, t, COUNT_MS);
        expect(v).toBeGreaterThanOrEqual(lo);
        expect(v).toBeLessThanOrEqual(hi);
      }
    }
  });
  it("moves one way only", () => {
    let prev = 0;
    for (let t = 0; t <= COUNT_MS; t += 5) {
      const v = countValue(0, 100, t, COUNT_MS);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it("jumps straight to the target when there is no duration (reduced motion)", () => {
    expect(countValue(0, 808.5, 0, 0)).toBe(808.5);
  });
});
