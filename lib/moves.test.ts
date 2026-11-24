import { describe, expect, it } from "vitest";
import { deadStockValue, discountable, discountedPrice, pickPriceMove } from "./moves";
import type { Product } from "./types";

const p = (o: Partial<Product>): Product => ({
  id: "x", name: "X", cost: 5, price: 10, stock: 10, sold: 10, lastSoldDate: "2026-11-23", ...o,
});

describe("pickPriceMove", () => {
  it("prefers the worst below-cost product and suggests a price above cost", () => {
    const m = pickPriceMove([p({ id: "a", cost: 5, price: 4 }), p({ id: "b", cost: 9, price: 4 })], null);
    expect(m && m.kind === "raise" && m.product.id).toBe("b");
    expect(m && m.kind === "raise" && m.belowCost).toBe(true);
    expect(m && m.kind === "raise" && m.suggested).toBeGreaterThan(9);
  });
  it("asks for the cost instead of guessing", () => {
    expect(pickPriceMove([p({ id: "n", cost: null })], null)).toEqual({ kind: "missing-cost", product: expect.objectContaining({ id: "n" }) });
  });
  it("returns null when prices cover everything", () => {
    expect(pickPriceMove([p({ cost: 2, price: 10 })], null)).toBeNull();
  });
});

describe("discounts", () => {
  it("is 20% off but never below cost", () => {
    expect(discountedPrice(p({ cost: 5, price: 10 }))).toBe(8);
    expect(discountedPrice(p({ cost: 9, price: 10 }))).toBe(9);
  });
  it("skips already-discounted and below-cost products", () => {
    const list = [p({ id: "a" }), p({ id: "b", discountedFrom: 12 }), p({ id: "c", cost: 12, price: 10 })];
    expect(discountable(list, ["a", "b", "c"]).map((x) => x.id)).toEqual(["a"]);
  });
  it("values dead stock at cost, leaving out unknown costs", () => {
    expect(deadStockValue([p({ id: "a", stock: 4 }), p({ id: "b", cost: null })], ["a", "b"])).toBe(20);
  });
});

describe("price advice stays sane", () => {
  const oh = { rent: 250, bills: 60, supplies: 45, salaries: 0 };
  it("early in the month (few sales) it does not spread overhead over a handful of units", () => {
    const m = pickPriceMove([p({ cost: 5, price: 10, sold: 3 })], oh);
    // cost 5 at a 30% margin is 7.15, below the current 10, so no change is suggested
    expect(m).toBeNull();
  });
  it("a below-cost product early in the month gets a cost-based price, not a huge one", () => {
    const m = pickPriceMove([p({ cost: 9, price: 5, sold: 3 })], oh);
    expect(m && m.kind === "raise" && m.suggested).toBeLessThan(20);
    expect(m && m.kind === "raise" && m.withOverhead).toBe(false);
  });
  it("counts overhead once there are enough sales", () => {
    const m = pickPriceMove([p({ cost: 5, price: 6, sold: 40 })], oh);
    expect(m && m.kind === "raise" && m.withOverhead).toBe(true);
  });
  it("does not tell the seller to undo a discount they just made", () => {
    const thin = p({ id: "lamp", name: "Lamp", cost: 9, price: 9, sold: 40, discountedFrom: 10 });
    expect(pickPriceMove([thin], { rent: 100, bills: 0, supplies: 0, salaries: 0 })).toBeNull();
  });
});
