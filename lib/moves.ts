import { priceSuggestion } from "./margin";
import type { Overhead, Product } from "./types";

export type PriceMove =
  | { kind: "raise"; product: Product; suggested: number; belowCost: boolean }
  | { kind: "missing-cost"; product: Product }
  | null;

const totalSold = (ps: Product[]) =>
  ps.filter((p) => p.cost !== null).reduce((s, p) => s + p.sold, 0);

/** The one price change worth making now. Never guesses a missing cost. */
export function pickPriceMove(products: Product[], o: Overhead | null, target = 0.3): PriceMove {
  const units = totalSold(products);
  const costed = products.filter((p) => p.cost !== null);

  const below = costed
    .filter((p) => p.price < (p.cost as number))
    .sort((a, b) => (b.cost as number) - b.price - ((a.cost as number) - a.price));
  if (below[0]) {
    const s = priceSuggestion(below[0], o, units, target) as number;
    return { kind: "raise", product: below[0], suggested: s, belowCost: true };
  }

  const gaps = costed
    .map((p) => ({ p, s: priceSuggestion(p, o, units, target) as number }))
    .filter(({ p, s }) => s > p.price + 0.005)
    .sort((a, b) => (b.s - b.p.price) * (b.p.sold || 1) - (a.s - a.p.price) * (a.p.sold || 1));
  if (gaps[0]) return { kind: "raise", product: gaps[0].p, suggested: gaps[0].s, belowCost: false };

  const missing = products.find((p) => p.cost === null);
  return missing ? { kind: "missing-cost", product: missing } : null;
}

/** 20% off, never below cost. */
export function discountedPrice(p: Product, rate = 0.2): number {
  const d = Math.round(p.price * (1 - rate) * 100) / 100;
  return p.cost !== null ? Math.max(p.cost, d) : d;
}

/** Dead products that can still be discounted (not already, and not already below cost). */
export function discountable(products: Product[], deadIds: string[]): Product[] {
  const dead = new Set(deadIds);
  return products.filter(
    (p) =>
      dead.has(p.id) &&
      p.discountedFrom === undefined &&
      (p.cost === null || p.price > p.cost) &&
      discountedPrice(p) < p.price,
  );
}

/** Money sitting on the shelf in dead stock, at cost. Products with no cost are left out, not guessed. */
export function deadStockValue(products: Product[], deadIds: string[]): number {
  const dead = new Set(deadIds);
  return products
    .filter((p) => dead.has(p.id) && p.cost !== null)
    .reduce((s, p) => s + (p.cost as number) * p.stock, 0);
}
