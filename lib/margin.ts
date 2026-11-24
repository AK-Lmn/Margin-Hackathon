import type { Answer, Overhead, Product } from "./types";

const DEAD_DAYS = 30;
const DAY_MS = 86_400_000;

export function marginPct(p: Product): number | null {
  if (p.cost === null || !(p.price > 0)) return null;
  return (p.price - p.cost) / p.price;
}

export function overheadTotal(o: Overhead | null): number | null {
  if (!o) return null;
  return o.rent + o.bills + o.supplies + o.salaries;
}

export function deadStock(products: Product[], now: Date = new Date()): string[] {
  return products
    .filter((p) => {
      if (p.stock <= 0) return false;
      if (!p.lastSoldDate) return true;
      const days = (now.getTime() - new Date(p.lastSoldDate).getTime()) / DAY_MS;
      return days > DEAD_DAYS;
    })
    .map((p) => p.id);
}

export function breakEvenUnits(products: Product[], o: Overhead | null): number | null {
  const total = overheadTotal(o);
  if (total === null || total <= 0) return null;
  const costed = products.filter((p) => p.cost !== null);
  const soldUnits = costed.reduce((s, p) => s + p.sold, 0);
  let avg: number;
  if (soldUnits > 0) {
    avg = costed.reduce((s, p) => s + (p.price - (p.cost as number)) * p.sold, 0) / soldUnits;
  } else if (costed.length > 0) {
    avg = costed.reduce((s, p) => s + (p.price - (p.cost as number)), 0) / costed.length;
  } else return null;
  if (!(avg > 0)) return null;
  return Math.ceil(total / avg);
}

/** Below this many units sold, overhead per unit is too noisy to price from (3 sales would put a whole month's rent on each). */
export const MIN_SALES_FOR_OVERHEAD_SHARE = 10;

/** Price that covers cost + per-unit overhead share at the target margin. */
export function priceSuggestion(
  p: Product,
  o: Overhead | null,
  totalUnitsSold: number,
  targetMargin = 0.3,
): number | null {
  if (p.cost === null) return null;
  const total = overheadTotal(o);
  const share = total !== null && totalUnitsSold >= MIN_SALES_FOR_OVERHEAD_SHARE ? total / totalUnitsSold : 0;
  return Math.ceil(((p.cost + share) / (1 - targetMargin)) * 100 - 1e-9) / 100;
}

export function computeAnswer(
  products: Product[],
  o: Overhead | null,
  now: Date = new Date(),
): Answer {
  const costed = products.filter((p) => p.cost !== null);
  const revenue = costed.reduce((s, p) => s + p.price * p.sold, 0);
  const productCosts = costed.reduce((s, p) => s + (p.cost as number) * p.sold, 0);
  const oh = overheadTotal(o);
  const trueProfit = revenue - productCosts - (oh ?? 0);
  return {
    trueProfit,
    beforeOverhead: oh === null,
    revenue,
    productCosts,
    overheadTotal: oh ?? 0,
    breakEvenUnits: breakEvenUnits(products, o),
    deadStock: deadStock(products, now),
    losingMoney: trueProfit < 0,
    missingCost: products.filter((p) => p.cost === null).map((p) => p.id),
    belowCost: costed.filter((p) => p.price < (p.cost as number)).map((p) => p.id),
  };
}

/** Average profit per unit before overhead, weighted by units sold (simple average if none sold). null if no costed products. */
export function avgUnitMargin(products: Product[]): number | null {
  const costed = products.filter((p) => p.cost !== null);
  if (costed.length === 0) return null;
  const units = costed.reduce((s, p) => s + p.sold, 0);
  if (units > 0) {
    return costed.reduce((s, p) => s + (p.price - (p.cost as number)) * p.sold, 0) / units;
  }
  return costed.reduce((s, p) => s + (p.price - (p.cost as number)), 0) / costed.length;
}
