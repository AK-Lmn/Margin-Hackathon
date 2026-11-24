import { describe, expect, it } from "vitest";
import { buildFacts, factLines, factSheet, onDevicePrompt, parseShortAnswers, validateShort } from "./grounding";
import { sampleShop } from "./sample-shop";
import type { Overhead, Product } from "./types";

const NOW = new Date("2026-11-24T00:00:00Z");
const p = (o: Partial<Product>): Product => ({
  id: "x", name: "Mug", cost: 5, price: 10, stock: 10, sold: 0, lastSoldDate: "", ...o,
});
const oh: Overhead = { rent: 100, bills: 20, supplies: 10, salaries: 70 };

describe("buildFacts", () => {
  it("carries only numbers computed from the seller's own data", () => {
    const f = buildFacts(
      [p({ id: "a", name: "Case", cost: 5, price: 10, sold: 20, lastSoldDate: "2026-11-23" })],
      oh,
      NOW,
    );
    expect(f.revenue).toBe(200);
    expect(f.productCosts).toBe(100);
    expect(f.overhead).toBe(200);
    expect(f.trueProfit).toBe(-100);
    expect(f.beforeOverhead).toBe(false);
  });
  it("leaves unknowns null instead of guessing", () => {
    const f = buildFacts([p({ cost: null })], null, NOW);
    expect(f.overhead).toBeNull();
    expect(f.beforeOverhead).toBe(true);
    expect(f.products[0].cost).toBeNull();
    expect(f.priceMove).toEqual({ kind: "missing-cost", name: "Mug" });
  });
  it("flags below-cost with a suggestion above cost", () => {
    const f = buildFacts([p({ name: "Stand", cost: 5, price: 4, sold: 3, lastSoldDate: "2026-11-20" })], oh, NOW);
    expect(f.priceMove?.kind).toBe("raise");
    if (f.priceMove?.kind === "raise") {
      expect(f.priceMove.belowCost).toBe(true);
      expect(f.priceMove.suggested).toBeGreaterThan(5);
    }
  });
});

describe("validateShort: golden test, every number must trace to its own line of the input", () => {
  const shop = sampleShop(NOW);
  const facts = buildFacts(shop.products, shop.overhead, NOW);
  const lines = factLines(facts);

  it("accepts the fact lines themselves", () => {
    expect(validateShort(lines, facts)).toEqual({ ok: true });
  });
  it("accepts a rewording that keeps each line's numbers", () => {
    const a = {
      profit: `After $${facts.overhead} overhead you made $${facts.trueProfit.toFixed(2)}. Break-even is ${facts.breakEvenUnits} units.`,
      price: lines.price.replace("Suggested price:", "Charge"),
      dead: `Desk lamp and Keychain haven't sold in 30 days, and $${facts.deadStockValueAtCost} of stock sits there.`,
    };
    expect(validateShort(a, facts)).toEqual({ ok: true });
  });
  it("rejects an invented price", () => {
    const r = validateShort({ ...lines, price: "Charge $13.37 for the Phone stand." }, facts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invented).toContain(13.37);
  });
  it("rejects an invented sales figure", () => {
    expect(validateShort({ ...lines, profit: "You sold 500 units last week." }, facts).ok).toBe(false);
  });
  it("rejects a real number put on the wrong line (another product's price)", () => {
    // $12.00 is the Phone case price. It exists in the shop, but not in the price line's facts.
    const r = validateShort({ ...lines, price: "Phone stand costs $12.00 and sells for $4.50. Charge $9.89." }, facts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invented).toContain(12);
  });
  it("rejects spelled-out numbers", () => {
    const r = validateShort({ ...lines, profit: "You made about twelve hundred dollars." }, facts);
    expect(r.ok).toBe(false);
  });
  it("allows the fixed rules: 30 days, 20% off, zero", () => {
    expect(validateShort({ ...lines, dead: "Nothing sold in 30 days. Take 20% off. You have $0 coming from these." }, facts)).toEqual({ ok: true });
  });
  it("allows a count of the dead products", () => {
    expect(validateShort({ ...lines, dead: "2 products haven't sold in 30 days." }, facts)).toEqual({ ok: true });
  });
  it("allows numbers that are part of a product name", () => {
    const f = buildFacts([p({ name: "Mug 350ml" })], null, NOW);
    expect(validateShort({ profit: "No sales yet.", price: "Prices are fine.", dead: "Mug 350ml has no sales yet." }, f)).toEqual({ ok: true });
  });
});

describe("parseShortAnswers", () => {
  it("parses three plain lines, stripping numbering and bullets", () => {
    expect(parseShortAnswers("a\nb\nc")).toEqual({ profit: "a", price: "b", dead: "c" });
    expect(parseShortAnswers("1. a\n2) b\n- c\n")).toEqual({ profit: "a", price: "b", dead: "c" });
  });
  it("ignores a greeting when the points are numbered", () => {
    expect(parseShortAnswers("Hey! Here is your update:\n1. a\n2. b\n3. c")).toEqual({ profit: "a", price: "b", dead: "c" });
  });
  it("still tolerates clean and fenced JSON", () => {
    const j = '{"profit":"a","price":"b","dead":"c"}';
    expect(parseShortAnswers(j)).toEqual({ profit: "a", price: "b", dead: "c" });
    expect(parseShortAnswers("```json\n" + j + "\n```")).toEqual({ profit: "a", price: "b", dead: "c" });
  });
  it("returns null for junk or wrong line counts", () => {
    expect(parseShortAnswers("nope")).toBeNull();
    expect(parseShortAnswers("a\nb")).toBeNull();
    expect(parseShortAnswers('{"profit":"a"}')).toBeNull();
  });
});

describe("prompts", () => {
  const shop = sampleShop(NOW);
  const facts = buildFacts(shop.products, shop.overhead, NOW);

  it("fact sheet is small, plain English, and has no field names", () => {
    const sheet = factSheet(facts);
    expect(sheet).not.toContain("{");
    expect(sheet).not.toContain("trueProfit");
    expect(sheet.length).toBeLessThan(700);
  });
  it("fact sheet states the suggested price and the dead stock names", () => {
    const sheet = factSheet(facts);
    expect(sheet).toMatch(/Suggested price: \$\d/);
    expect(sheet).toContain("Desk lamp");
  });
  it("handles missing overhead and no sales", () => {
    expect(factSheet(buildFacts(shop.products, null, NOW))).toContain("overhead is missing");
    expect(factSheet(buildFacts([p({})], oh, NOW))).toContain("No sales yet");
  });
  it("says when there are too few sales to count overhead in the price", () => {
    const f = buildFacts([p({ cost: 9, price: 5, sold: 3, lastSoldDate: "2026-11-20" })], oh, NOW);
    expect(factSheet(f)).toContain("too few sales");
  });
  it("prompt forbids invention and cheering", () => {
    const t = onDevicePrompt(facts).toLowerCase();
    expect(t).toContain("never invent");
    expect(t).toContain("no greetings");
    expect(t).toContain("exclamation");
  });
});
