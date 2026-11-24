import { describe, expect, it } from "vitest";
import { buildFacts, factSheet, onDevicePrompt, parseShortAnswers, validateGrounded } from "./grounding";
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

describe("validateGrounded: golden test, every number must trace to the input", () => {
  const shop = sampleShop(NOW);
  const facts = buildFacts(shop.products, shop.overhead, NOW);

  it("accepts text that only uses numbers from the facts", () => {
    const ok = `Your true profit this month is ${facts.trueProfit.toFixed(2)} dollars after ${facts.overhead} of overhead.`;
    expect(validateGrounded(ok, facts)).toEqual({ ok: true });
  });
  it("accepts break-even and a suggested price from the facts", () => {
    const m = facts.priceMove;
    expect(m?.kind).toBe("raise");
    if (m?.kind !== "raise") return;
    const text = `Charge $${m.suggested.toFixed(2)} for ${m.name}. Sell ${facts.breakEvenUnits} units to break even.`;
    expect(validateGrounded(text, facts)).toEqual({ ok: true });
  });
  it("rejects an invented price", () => {
    const r = validateGrounded("Charge $13.37 for the Phone stand.", facts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invented).toContain(13.37);
  });
  it("rejects an invented sales figure", () => {
    const r = validateGrounded("You sold 500 units last week.", facts);
    expect(r.ok).toBe(false);
  });
  it("allows the fixed rules: 30 days, 30% margin, 20% discount", () => {
    expect(validateGrounded("Nothing sold in 30 days. Take 20% off. Aim for a 30% margin.", facts)).toEqual({ ok: true });
  });
  it("allows numbers that are part of a product name", () => {
    const f = buildFacts([p({ name: "Mug 350ml" })], null, NOW);
    expect(validateGrounded("Mug 350ml has no sales yet.", f)).toEqual({ ok: true });
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

  it("fact sheet is small, plain English, and grounded in the facts", () => {
    const sheet = factSheet(facts);
    expect(sheet).not.toContain("{");
    expect(sheet).not.toContain("trueProfit");
    expect(sheet.length).toBeLessThan(700);
    // numbered list markers aside, every number must trace to the facts
    expect(validateGrounded(sheet.replace(/^\d\.\s/gm, ""), facts)).toEqual({ ok: true });
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
  it("prompt forbids invention", () => {
    expect(onDevicePrompt(facts).toLowerCase()).toContain("never invent");
  });
  it("prompt asks for a flat tone with no greetings or cheering", () => {
    const t = onDevicePrompt(facts).toLowerCase();
    expect(t).toContain("no greetings");
    expect(t).toContain("exclamation");
  });
});
