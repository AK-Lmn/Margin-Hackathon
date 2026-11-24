export type Product = {
  id: string;
  name: string;
  /** Cost per unit. null = seller has not entered it; never guessed. */
  cost: number | null;
  price: number;
  stock: number;
  /** Units sold this month. */
  sold: number;
  /** ISO date of last sale. Empty string = never sold. */
  lastSoldDate: string;
  /** Original price when the seller discounted this product. */
  discountedFrom?: number;
};

export type Overhead = {
  rent: number;
  bills: number;
  supplies: number;
  salaries: number;
};

export type Answer = {
  trueProfit: number;
  /** True when overhead is missing, so trueProfit is really profit before overhead. */
  beforeOverhead: boolean;
  revenue: number;
  productCosts: number;
  overheadTotal: number;
  breakEvenUnits: number | null;
  deadStock: string[];
  losingMoney: boolean;
  /** Products with no cost entered: excluded from profit, never guessed. */
  missingCost: string[];
  /** Products priced below cost. */
  belowCost: string[];
};
