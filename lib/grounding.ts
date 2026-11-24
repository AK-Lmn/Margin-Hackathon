import { computeAnswer, marginPct } from "./margin";
import { deadStockValue, pickPriceMove } from "./moves";
import type { Overhead, Product } from "./types";
import { daysSince } from "./format";

/** Every number the model may use. All computed locally from the seller's own data. */
export type Facts = {
  trueProfit: number;
  beforeOverhead: boolean;
  revenue: number;
  productCosts: number;
  overhead: number | null;
  breakEvenUnits: number | null;
  unitsSold: number;
  products: {
    name: string;
    cost: number | null;
    price: number;
    stock: number;
    sold: number;
    marginPct: number | null;
    belowCost: boolean;
  }[];
  deadStock: { name: string; stock: number; daysSinceSale: number | null }[];
  deadStockValueAtCost: number;
  priceMove:
    | { kind: "raise"; name: string; currentPrice: number; cost: number; suggested: number; belowCost: boolean }
    | { kind: "missing-cost"; name: string }
    | null;
};

export function buildFacts(products: Product[], o: Overhead | null, now: Date): Facts {
  const a = computeAnswer(products, o, now);
  const move = pickPriceMove(products, o);
  const byId = new Map(products.map((p) => [p.id, p]));
  return {
    trueProfit: round2(a.trueProfit),
    beforeOverhead: a.beforeOverhead,
    revenue: round2(a.revenue),
    productCosts: round2(a.productCosts),
    overhead: o ? a.overheadTotal : null,
    breakEvenUnits: a.breakEvenUnits,
    unitsSold: products.filter((p) => p.cost !== null).reduce((s, p) => s + p.sold, 0),
    products: products.map((p) => {
      const m = marginPct(p);
      return {
        name: p.name,
        cost: p.cost,
        price: p.price,
        stock: p.stock,
        sold: p.sold,
        marginPct: m === null ? null : Math.round(m * 100),
        belowCost: p.cost !== null && p.price < p.cost,
      };
    }),
    deadStock: a.deadStock.map((id) => {
      const p = byId.get(id) as Product;
      return { name: p.name, stock: p.stock, daysSinceSale: daysSince(p.lastSoldDate, now) };
    }),
    deadStockValueAtCost: round2(deadStockValue(products, a.deadStock)),
    priceMove: !move
      ? null
      : move.kind === "missing-cost"
        ? { kind: "missing-cost", name: move.product.name }
        : {
            kind: "raise",
            name: move.product.name,
            currentPrice: move.product.price,
            cost: move.product.cost as number,
            suggested: move.suggested,
            belowCost: move.belowCost,
          },
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ---------- Prompts ---------- */

const RULES = `You explain a small shop's numbers in plain words.
Rules:
- Only use numbers from FACTS. Copy them exactly. Never calculate new numbers, never estimate, never invent a cost, price, sale or competitor.
- If a value is null, say it is missing and ask the seller to add it.
- Currency is dollars. Be direct and specific. No greetings, no filler.`;

export function onDevicePrompt(facts: Facts): string {
  return `${RULES}

FACTS:
${JSON.stringify(facts)}

Write three answers, each one sentence of at most 25 words:
- "profit": is the shop making money? Say true profit, and "before overhead" if beforeOverhead is true.
- "price": what to charge. Use priceMove. If belowCost, say they are losing money on it.
- "dead": what is not selling. Name the products in deadStock; if empty, say nothing is dead.

Reply with only JSON: {"profit": "...", "price": "...", "dead": "..."}`;
}

export function cloudPrompt(facts: Facts): string {
  return `${RULES}

FACTS:
${JSON.stringify(facts)}

Write a short shop plan. Reply with only JSON:
{"summary": "two sentences on where the shop stands",
 "steps": ["up to 4 concrete next actions, each one sentence, most important first"],
 "discountOrder": ["names from deadStock, best to discount first"]}
Only use product names that appear in FACTS.`;
}

/* ---------- Parsing ---------- */

export type ShortAnswers = { profit: string; price: string; dead: string };

function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

export function parseShortAnswers(text: string): ShortAnswers | null {
  const j = parseJson(text) as Record<string, unknown> | null;
  if (!j || typeof j !== "object") return null;
  const { profit, price, dead } = j;
  if (typeof profit !== "string" || typeof price !== "string" || typeof dead !== "string") return null;
  return { profit, price, dead };
}

export type Strategy = { summary: string; steps: string[]; discountOrder: string[] };

export function parseStrategy(text: string): Strategy | null {
  const j = parseJson(text) as Record<string, unknown> | null;
  if (!j || typeof j.summary !== "string" || !Array.isArray(j.steps)) return null;
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return { summary: j.summary, steps: strs(j.steps).slice(0, 4), discountOrder: strs(j.discountOrder) };
}

/* ---------- Grounding check ---------- */

/** Fixed rules of the app, allowed in any answer. */
const CONSTANTS = [30, 20];

function collectNumbers(v: unknown, out: Set<number>): void {
  if (typeof v === "number" && Number.isFinite(v)) {
    out.add(v);
    out.add(Math.abs(v));
    out.add(Math.round(v));
    out.add(round2(v));
  } else if (Array.isArray(v)) v.forEach((x) => collectNumbers(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collectNumbers(x, out));
}

export function extractNumbers(text: string): number[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((s) => Number(s.replace(/,/g, "")));
}

export type Grounded = { ok: true } | { ok: false; invented: number[] };

/** Every number in the model's text must appear in the facts (or be a fixed app rule, or part of a product name). */
export function validateGrounded(text: string, facts: Facts): Grounded {
  const allowed = new Set<number>(CONSTANTS);
  collectNumbers(facts, allowed);
  for (const p of facts.products) extractNumbers(p.name).forEach((n) => allowed.add(n));

  const invented = extractNumbers(text).filter((n) => {
    for (const a of allowed) if (Math.abs(a - n) < 0.005) return false;
    return true;
  });
  return invented.length === 0 ? { ok: true } : { ok: false, invented };
}
