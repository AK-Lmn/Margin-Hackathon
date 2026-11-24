import { describe, expect, it } from "vitest";
import { duration } from "./format";

describe("duration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(duration(800)).toBe("0.8s");
    expect(duration(4100)).toBe("4.1s");
    expect(duration(125000)).toBe("2m 5s");
    expect(duration(3780000)).toBe("1h 3m");
  });
});
