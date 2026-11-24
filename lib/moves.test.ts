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
