import { describe, expect, it } from "vitest";
import { clearOp, deleteOp, discountOp, overheadOp, parseStore, setPriceOp, type Store } from "./store";
import type { Product } from "./types";

const p = (o: Partial<Product>): Product => ({
  id: "a", name: "A", cost: 5, price: 10, stock: 5, sold: 1, lastSoldDate: "2026-11-20", ...o,
});
const base = (): Store => ({ products: [p({ id: "a" }), p({ id: "b", price: 20 })], overhead: null });

describe("undo only reverses its own change", () => {
  it("price undo keeps a product added afterwards", () => {
    const op = setPriceOp(base(), "a", 15);
    const afterEdit: Store = { ...op.next, products: [p({ id: "new" }), ...op.next.products] };
    const undone = op.undo(afterEdit);
    expect(undone.products.map((x) => x.id)).toEqual(["new", "a", "b"]);
    expect(undone.products.find((x) => x.id === "a")?.price).toBe(10);
  });
  it("price undo leaves other products' later price edits alone", () => {
    const op = setPriceOp(base(), "a", 15);
    const cur: Store = { ...op.next, products: op.next.products.map((x) => (x.id === "b" ? { ...x, price: 99 } : x)) };
    expect(op.undo(cur).products.find((x) => x.id === "b")?.price).toBe(99);
  });
  it("discount undo restores price and clears the discount mark", () => {
    const op = discountOp(base(), ["a"], (x) => x.price * 0.8);
    expect(op.next.products[0]).toMatchObject({ price: 8, discountedFrom: 10 });
    const undone = op.undo(op.next).products[0];
    expect(undone.price).toBe(10);
    expect(undone.discountedFrom).toBeUndefined();
  });
  it("overhead undo restores the old value", () => {
    const op = overheadOp(base(), { rent: 1, bills: 1, supplies: 1, salaries: 1 });
    expect(op.undo(op.next).overhead).toBeNull();
  });
  it("delete undo puts the product back in its place, even after other edits", () => {
    const op = deleteOp(base(), "a");
    const cur: Store = { ...op.next, products: [...op.next.products, p({ id: "later" })] };
    expect(op.undo(cur).products.map((x) => x.id)).toEqual(["a", "b", "later"]);
  });
  it("clear undo keeps products added after clearing", () => {
    const op = clearOp(base());
    const cur: Store = { ...op.next, products: [p({ id: "fresh" })] };
    expect(op.undo(cur).products.map((x) => x.id)).toEqual(["a", "b", "fresh"]);
  });
});

describe("parseStore", () => {
  const good = JSON.stringify({ products: [p({ id: "a" })], overhead: { rent: 1, bills: 2, supplies: 3, salaries: 0 } });
  it("accepts good data", () => {
    expect(parseStore(good)?.products).toHaveLength(1);
    expect(parseStore(good)?.overhead).toEqual({ rent: 1, bills: 2, supplies: 3, salaries: 0 });
  });
  it("drops products with missing or wrong fields instead of showing NaN", () => {
    const raw = JSON.stringify({
      products: [p({ id: "ok" }), { id: "nocost", name: "x", price: 1, stock: 1, sold: 1, lastSoldDate: "" }, { id: "neg", name: "n", cost: 1, price: -4, stock: 1, sold: 1, lastSoldDate: "" }, 7, null],
      overhead: null,
    });
    expect(parseStore(raw)?.products.map((x) => x.id)).toEqual(["ok"]);
  });
  it("turns broken overhead into not entered", () => {
    expect(parseStore(JSON.stringify({ products: [], overhead: { rent: "x" } }))?.overhead).toBeNull();
  });
  it("returns null for junk", () => {
    expect(parseStore(null)).toBeNull();
    expect(parseStore("not json")).toBeNull();
    expect(parseStore('{"products":"no"}')).toBeNull();
  });
});

describe("first visit", () => {
  const NOW = new Date("2026-11-25T10:00:00");
  it("loads the sample shop when nothing is saved", async () => {
    const { loadOrSample } = await import("./store");
    const s = loadOrSample(null, NOW);
    expect(s.products.length).toBeGreaterThanOrEqual(8);
    expect(s.overhead).not.toBeNull();
  });
  it("loads the sample shop when the saved data is unreadable", async () => {
    const { loadOrSample } = await import("./store");
    expect(loadOrSample("not json", NOW).products.length).toBeGreaterThan(0);
  });
  it("keeps a shop the seller cleared with Start over (saved but empty)", async () => {
    const { loadOrSample } = await import("./store");
    const s = loadOrSample(JSON.stringify({ products: [], overhead: null }), NOW);
    expect(s.products).toEqual([]);
    expect(s.overhead).toBeNull();
  });
  it("keeps the seller's own saved products", async () => {
    const { loadOrSample } = await import("./store");
    const saved = JSON.stringify({ products: [p({ id: "mine", name: "Mine" })], overhead: null });
    expect(loadOrSample(saved, NOW).products.map((x) => x.id)).toEqual(["mine"]);
  });
});

describe("blankProduct", () => {
  it("is empty with quantity 0 and last sale set to today (local date)", async () => {
    const { blankProduct } = await import("./store");
    const b = blankProduct(new Date(2026, 10, 25, 23, 59));
    expect(b).toMatchObject({ id: "", name: "", cost: null, price: 0, stock: 0, sold: 0, lastSoldDate: "2026-11-25" });
  });
});
