import { computeAnswer, marginPct } from "./margin";
import { deadStockValue, pickPriceMove } from "./moves";
import type { Overhead, Product } from "./types";
import { daysSince, money } from "./format";

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
    | {
        kind: "raise";
        name: string;
        currentPrice: number;
        cost: number;
        suggested: number;
        belowCost: boolean;
        withOverhead: boolean;
      }
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
            withOverhead: move.withOverhead,
          },
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ---------- The three answers ---------- */

export type ShortAnswers = { profit: string; price: string; dead: string };
const KEYS = ["profit", "price", "dead"] as const;

/**
 * One plain sentence of facts per answer. These feed the prompt, and each one is also the only
 * source of numbers its answer may use.
 */
export function factLines(f: Facts): ShortAnswers {
  const profit =
    f.revenue === 0
      ? "No sales yet this month."
      : f.beforeOverhead
        ? `Profit before overhead (overhead is missing): ${money(f.trueProfit)}.`
        : `Profit this month after ${money(f.overhead ?? 0)} overhead: ${money(f.trueProfit)}.${
            f.breakEvenUnits === null ? "" : ` Break-even is ${f.breakEvenUnits} units a month.`
          }`;

  const m = f.priceMove;
  const price = !m
    ? "Prices already cover costs and overhead."
    : m.kind === "missing-cost"
      ? `The cost of ${m.name} is missing, so there is no price advice yet.`
      : `${m.name} sells for ${money(m.currentPrice, { forceCents: true })} and costs ${money(m.cost, { forceCents: true })}${
          m.belowCost ? ", so every sale loses money" : ""
        }. Suggested price: ${money(m.suggested, { forceCents: true })}.${
          m.withOverhead ? "" : " There are too few sales to count overhead in the price yet."
        }`;

  const dead =
    f.deadStock.length === 0
      ? "Nothing is dead. Everything sold in the last 30 days."
      : `Not sold in 30 days: ${f.deadStock.map((d) => d.name).join(", ")}.${
          f.deadStockValueAtCost > 0 ? ` ${money(f.deadStockValueAtCost)} of stock at cost sits on the shelf.` : ""
        }`;

  return { profit, price, dead };
}

/**
 * Three plain lines of facts, small enough for a tiny on-device model to answer quickly.
 * Plain English instead of JSON so the model has no field names to echo back.
 */
export function factSheet(f: Facts): string {
  const l = factLines(f);
  return `1. ${l.profit}\n2. ${l.price}\n3. ${l.dead}`;
}

export function onDevicePrompt(facts: Facts): string {
  return `You explain a small shop's numbers to its owner in plain words.

${factSheet(facts)}

Rewrite those three points as exactly 3 lines, in the same order, in plain words, at most 25 words each.
Start each line with the fact. Write like a calm bookkeeper: no greetings, no praise, no exclamation marks.
Copy every number exactly as written. Add no other numbers. Write numbers as digits. Never invent a cost, price or sale.
If something is missing, say it is missing. No labels, no bullets, no JSON.`;
}

/* ---------- Parsing ---------- */

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
  // Preferred: three plain lines. Strip any "1." / "-" the model adds anyway.
  const raw = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const strip = (l: string) => l.replace(/^(?:\d+[.)]|[-*•])\s*/, "").trim();
  if (!text.includes("{") && !text.includes("```")) {
    // Models sometimes add a greeting. If the points are numbered, trust the numbered lines.
    const numbered = raw.filter((l) => /^\d+[.)]\s/.test(l));
    const picked = numbered.length === 3 ? numbered : raw;
    if (picked.length === 3) {
      const [profit, price, dead] = picked.map(strip);
      return { profit, price, dead };
    }
  }
  // Tolerate JSON in case a model answers that way.
  const j = parseJson(text) as Record<string, unknown> | null;
  if (!j || typeof j !== "object") return null;
  const { profit, price, dead } = j;
  if (typeof profit !== "string" || typeof price !== "string" || typeof dead !== "string") return null;
  return { profit, price, dead };
}

/* ---------- Grounding check ---------- */

/** Fixed rules of the app (30 days, 20% off, 30% margin) and zero, allowed in any answer. */
const CONSTANTS = [0, 30, 20];

/** Spelled-out numbers dodge a digit check, so they are refused. "one" is left alone: it is also a pronoun. */
const NUMBER_WORDS =
  /\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|dozen)\b/i;

export function extractNumbers(text: string): number[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((s) => Number(s.replace(/,/g, "")));
}

export type Grounded = { ok: true } | { ok: false; invented: (number | string)[] };

/**
 * Each answer may only use the numbers from its own fact line (plus fixed app rules, digits inside
 * product names, and the count of dead products for the "not selling" answer). A number that exists
 * elsewhere in the shop, such as another product's price, is refused here.
 */
export function validateShort(a: ShortAnswers, f: Facts): Grounded {
  const source = factLines(f);
  const nameNumbers = f.products.flatMap((p) => extractNumbers(p.name));
  const invented: (number | string)[] = [];

  for (const k of KEYS) {
    const allowed = [...extractNumbers(source[k]), ...CONSTANTS, ...nameNumbers];
    if (k === "dead") allowed.push(f.deadStock.length);
    for (const n of extractNumbers(a[k])) {
      if (!allowed.some((x) => Math.abs(x - n) < 0.005)) invented.push(n);
    }
    const word = a[k].match(NUMBER_WORDS);
    if (word) invented.push(word[0].toLowerCase());
  }
  return invented.length === 0 ? { ok: true } : { ok: false, invented };
}
