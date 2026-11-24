import { describe, expect, it } from "vitest";
import type { Overhead, Product } from "./types";
import {
  breakEvenUnits,
  computeAnswer,
  deadStock,
  marginPct,
  overheadTotal,
  priceSuggestion,
} from "./margin";

const NOW = new Date("2026-11-24T00:00:00Z");
const p = (o: Partial<Product>): Product => ({
  id: "x", name: "X", cost: 5, price: 10, stock: 10, sold: 0, lastSoldDate: "", ...o,
});
const oh: Overhead = { rent: 100, bills: 20, supplies: 10, salaries: 70 }; // 200

describe("marginPct", () => {
  it("is (price - cost) / price", () => {
    expect(marginPct(p({ cost: 6, price: 10 }))).toBeCloseTo(0.4);
  });
  it("is negative when price below cost", () => {
    expect(marginPct(p({ cost: 12, price: 10 }))).toBeCloseTo(-0.2);
  });
  it("is null without a cost or price", () => {
    expect(marginPct(p({ cost: null }))).toBeNull();
    expect(marginPct(p({ price: 0 }))).toBeNull();
  });
});

describe("overheadTotal", () => {
  it("sums fields, null when missing", () => {
    expect(overheadTotal(oh)).toBe(200);
    expect(overheadTotal(null)).toBeNull();
  });
});

describe("deadStock", () => {
  it("flags no sale in 30 days or never sold, only with stock on shelf", () => {
    const list = [
      p({ id: "recent", lastSoldDate: "2026-11-20" }),
      p({ id: "old", lastSoldDate: "2026-10-01" }),
      p({ id: "never", lastSoldDate: "" }),
      p({ id: "empty-shelf", lastSoldDate: "", stock: 0 }),
      p({ id: "edge", lastSoldDate: "2026-10-25" }), // 30 days: not dead yet
    ];
    expect(deadStock(list, NOW)).toEqual(["old", "never"]);
  });
  it("is empty when everything sells", () => {
    expect(deadStock([p({ lastSoldDate: "2026-11-23" })], NOW)).toEqual([]);
  });
});

describe("computeAnswer", () => {
  const products = [
    p({ id: "a", cost: 5, price: 10, sold: 20, lastSoldDate: "2026-11-23" }), // rev 200 cost 100
    p({ id: "b", cost: 2, price: 6, sold: 10, lastSoldDate: "2026-11-22" }), // rev 60 cost 20
  ];
  it("true profit = revenue - product costs - overhead", () => {
    const a = computeAnswer(products, oh, NOW);
    expect(a.revenue).toBe(260);
    expect(a.productCosts).toBe(120);
    expect(a.trueProfit).toBe(-60);
    expect(a.losingMoney).toBe(true);
    expect(a.beforeOverhead).toBe(false);
  });
  it("labels before overhead when overhead missing", () => {
    const a = computeAnswer(products, null, NOW);
    expect(a.trueProfit).toBe(140);
    expect(a.beforeOverhead).toBe(true);
    expect(a.losingMoney).toBe(false);
  });
  it("excludes products with no cost instead of guessing", () => {
    const a = computeAnswer([...products, p({ id: "c", cost: null, price: 99, sold: 5 })], null, NOW);
    expect(a.missingCost).toEqual(["c"]);
    expect(a.revenue).toBe(260);
  });
  it("flags price below cost", () => {
    expect(computeAnswer([p({ id: "z", cost: 12, price: 10 })], null, NOW).belowCost).toEqual(["z"]);
  });
  it("no sales: profit is minus overhead, not invented", () => {
    expect(computeAnswer([p({})], oh, NOW).trueProfit).toBe(-200);
  });
});

describe("breakEvenUnits", () => {
  it("overhead / avg margin per unit (sold-weighted), rounded up", () => {
    const list = [p({ cost: 5, price: 10, sold: 20 }), p({ cost: 2, price: 6, sold: 10 })];
    // (5*20 + 4*10) / 30 = 4.667 per unit; 200 / 4.667 = 42.86 -> 43
    expect(breakEvenUnits(list, oh)).toBe(43);
  });
  it("falls back to simple average when nothing sold", () => {
    expect(breakEvenUnits([p({ cost: 5, price: 10 })], oh)).toBe(40);
  });
  it("null when no positive margin or no overhead", () => {
    expect(breakEvenUnits([p({ cost: 12, price: 10 })], oh)).toBeNull();
    expect(breakEvenUnits([p({})], null)).toBeNull();
  });
});

describe("priceSuggestion", () => {
  it("covers cost + overhead share at target margin, rounded up to cents", () => {
    // overhead per unit = 200/40 = 5; (5+5)/(1-0.3) = 14.2857 -> 14.29
    expect(priceSuggestion(p({ cost: 5 }), oh, 40, 0.3)).toBe(14.29);
  });
  it("null without cost; ignores overhead share when no sales", () => {
    expect(priceSuggestion(p({ cost: null }), oh, 40, 0.3)).toBeNull();
    expect(priceSuggestion(p({ cost: 7 }), oh, 0, 0.3)).toBe(10);
  });
});
