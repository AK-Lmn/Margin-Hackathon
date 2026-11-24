import { sampleShop } from "./sample-shop";
import type { Overhead, Product } from "./types";

export type Store = { products: Product[]; overhead: Overhead | null };

/** Local calendar date as YYYY-MM-DD (not UTC, so late evening does not become tomorrow). */
export function localIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** What the Add product form starts from, every time: empty, quantity 0, last sale today. */
export function blankProduct(now: Date): Product {
  return { id: "", name: "", cost: null, price: 0, stock: 0, sold: 0, lastSoldDate: localIsoDate(now) };
}

/** A change plus its undo. Undo reverses only this change, so edits made afterwards survive. */
export type Op = { next: Store; undo: (current: Store) => Store };

const keep: Op["undo"] = (s) => s;
const mapProducts = (s: Store, f: (p: Product) => Product): Store => ({ ...s, products: s.products.map(f) });

export function setPriceOp(s: Store, id: string, price: number): Op {
  const old = s.products.find((p) => p.id === id);
  if (!old) return { next: s, undo: keep };
  return {
    next: mapProducts(s, (p) => (p.id === id ? { ...p, price, discountedFrom: undefined } : p)),
    undo: (cur) =>
      mapProducts(cur, (p) => (p.id === id ? { ...p, price: old.price, discountedFrom: old.discountedFrom } : p)),
  };
}

export function discountOp(s: Store, ids: string[], priceOf: (p: Product) => number): Op {
  const before = new Map(s.products.filter((p) => ids.includes(p.id)).map((p) => [p.id, p]));
  return {
    next: mapProducts(s, (p) => (before.has(p.id) ? { ...p, discountedFrom: p.price, price: priceOf(p) } : p)),
    undo: (cur) =>
      mapProducts(cur, (p) => {
        const o = before.get(p.id);
        return o ? { ...p, price: o.price, discountedFrom: o.discountedFrom } : p;
      }),
  };
}

export function overheadOp(s: Store, o: Overhead): Op {
  const prev = s.overhead;
  return { next: { ...s, overhead: o }, undo: (cur) => ({ ...cur, overhead: prev }) };
}

export function deleteOp(s: Store, id: string): Op {
  const idx = s.products.findIndex((p) => p.id === id);
  const old = s.products[idx];
  if (!old) return { next: s, undo: keep };
  return {
    next: { ...s, products: s.products.filter((p) => p.id !== id) },
    undo: (cur) =>
      cur.products.some((p) => p.id === id)
        ? cur
        : { ...cur, products: [...cur.products.slice(0, idx), old, ...cur.products.slice(idx)] },
  };
}

export function clearOp(s: Store): Op {
  return {
    next: { products: [], overhead: null },
    undo: (cur) => ({ products: [...s.products, ...cur.products], overhead: cur.overhead ?? s.overhead }),
  };
}

/* ---------- Loading saved data ---------- */

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

function cleanProduct(v: unknown): Product | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  if (typeof p.id !== "string" || typeof p.name !== "string" || typeof p.lastSoldDate !== "string") return null;
  if (!(p.cost === null || num(p.cost)) || !num(p.price) || !num(p.stock) || !num(p.sold)) return null;
  const out: Product = {
    id: p.id, name: p.name, cost: p.cost as number | null,
    price: p.price, stock: p.stock, sold: p.sold, lastSoldDate: p.lastSoldDate,
  };
  if (num(p.discountedFrom)) out.discountedFrom = p.discountedFrom;
  return out;
}

function cleanOverhead(v: unknown): Overhead | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return num(o.rent) && num(o.bills) && num(o.supplies) && num(o.salaries)
    ? { rent: o.rent, bills: o.bills, supplies: o.supplies, salaries: o.salaries }
    : null;
}

/** Reads saved data defensively: bad products are dropped, bad overhead becomes "not entered". */
export function parseStore(raw: string | null): Store | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { products?: unknown; overhead?: unknown };
    if (!Array.isArray(j.products)) return null;
    return {
      products: j.products.map(cleanProduct).filter((p): p is Product => p !== null),
      overhead: cleanOverhead(j.overhead),
    };
  } catch {
    return null;
  }
}

/**
 * First visit (nothing saved, or saved data unreadable): show the sample shop so the first screen is
 * the hero number, the chart and the three answers. A shop saved as empty (Start over) stays empty.
 */
export function loadOrSample(raw: string | null, now: Date): Store {
  return parseStore(raw) ?? sampleShop(now);
}
