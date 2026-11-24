import type { Overhead, Product } from "./types";

const daysAgo = (now: Date, n: number) =>
  new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10);

/** Generic small online shop, ~10 products, $ currency. Dates are relative to `now` so dead stock stays dead. */
export function sampleShop(now: Date = new Date()): { products: Product[]; overhead: Overhead } {
  const mk = (
    id: string, name: string, cost: number | null, price: number,
    stock: number, sold: number, lastSold: number | null,
  ): Product => ({
    id, name, cost, price, stock, sold,
    lastSoldDate: lastSold === null ? "" : daysAgo(now, lastSold),
  });
  return {
    products: [
      mk("phone-case", "Phone case", 4, 12, 40, 38, 1),
      mk("water-bottle", "Water bottle", 6, 18, 25, 20, 2),
      mk("tote-bag", "Tote bag", 3, 10, 30, 26, 3),
      mk("notebook", "Notebook", 2, 7, 60, 31, 1),
      mk("mug", "Mug", 5, 14, 18, 12, 6),
      mk("sticker-pack", "Sticker pack", 0.8, 4, 120, 55, 1),
      mk("phone-stand", "Phone stand", 5, 4.5, 22, 3, 9), // priced below cost
      mk("desk-lamp", "Desk lamp", 14, 29, 12, 0, 41), // dead
      mk("keychain", "Keychain", 1.2, 5, 80, 0, null), // dead, never sold
      mk("enamel-pin", "Enamel pin", null, 6, 35, 4, 12), // no cost entered
    ],
    overhead: { rent: 250, bills: 60, supplies: 45, salaries: 0 },
  };
}
