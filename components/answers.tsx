"use client";
import { PackageX, Receipt, Tag } from "lucide-react";
import { money } from "@/lib/format";
import { deadStockValue, discountable, pickPriceMove } from "@/lib/moves";
import type { Answer, Overhead, Product } from "@/lib/types";

type Props = {
  products: Product[];
  overhead: Overhead | null;
  answer: Answer;
  flash: string | null;
  onEditOverhead: () => void;
  onSetPrice: (id: string, price: number) => void;
  onEditProduct: (id: string) => void;
  onDiscount: (ids: string[]) => void;
};

function Row({
  i, icon, title, detail, action, flashing,
}: {
  i: number;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void; primary?: boolean };
  flashing?: boolean;
}) {
  return (
    <li
      key={flashing ? "f" : "n"}
      className={`rise flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-5 sm:py-5 ${flashing ? "confirm" : ""}`}
      style={{ "--i": i + 3 } as React.CSSProperties}
    >
      <div className="flex min-w-0 flex-1 gap-3.5">
        <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
        <div className="min-w-0">
          <h3 className="text-pretty text-base font-semibold leading-snug sm:text-lg">{title}</h3>
          {detail && <p className="mt-1 text-pretty text-sm leading-relaxed text-muted">{detail}</p>}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className={`press min-h-11 shrink-0 rounded-full px-5 text-sm font-semibold sm:min-w-36 ${
            action.primary
              ? "bg-ink text-bg hover:bg-ink/85"
              : "border border-line bg-bg text-ink hover:bg-wash"
          }`}
        >
          {action.label}
        </button>
      )}
    </li>
  );
}

export function Answers({ products, overhead, answer, flash, onEditOverhead, onSetPrice, onEditProduct, onDiscount }: Props) {
  const move = pickPriceMove(products, overhead);
  const dead = answer.deadStock;
  const todo = discountable(products, dead);
  const tied = deadStockValue(products, dead);

  // 1: making money?
  const profitRow = (() => {
    if (answer.revenue === 0)
      return { title: "No sales yet, so profit is $0 before overhead", detail: "Enter units sold on a product to see what you made." };
    if (answer.beforeOverhead)
      return {
        title: "Overhead is missing, so this is not your true profit",
        detail: "Rent, bills, supplies and staff pay come off the top.",
        action: { label: "Add monthly costs", onClick: onEditOverhead, primary: true },
      };
    if (answer.losingMoney)
      return {
        title: answer.breakEvenUnits
          ? `You're losing ${money(-answer.trueProfit)}. Sell ${answer.breakEvenUnits} units to break even`
          : `You're losing ${money(-answer.trueProfit)} and your margin doesn't cover overhead`,
        detail: `Overhead is ${money(answer.overheadTotal)} a month.`,
        action: { label: "Edit overhead", onClick: onEditOverhead },
      };
    return {
      title: `You cleared overhead by ${money(answer.trueProfit)}`,
      detail: answer.breakEvenUnits ? `Break-even is ${answer.breakEvenUnits} units a month.` : undefined,
      action: { label: "Edit overhead", onClick: onEditOverhead },
    };
  })();

  // 2: what to charge?
  const priceRow = (() => {
    if (!move)
      return { title: "Your prices cover costs and overhead", detail: "No price needs changing right now." };
    const p = move.product;
    if (move.kind === "missing-cost")
      return {
        title: `Add the cost of ${p.name} to see its price`,
        detail: "Without it, Margin can't tell whether you make money on it.",
        action: { label: "Add cost", onClick: () => onEditProduct(p.id), primary: true },
      };
    return {
      title: move.belowCost
        ? `You're losing money on ${p.name}. Charge ${money(move.suggested, { forceCents: true })}`
        : `Charge ${money(move.suggested, { forceCents: true })} for ${p.name}`,
      detail: `Now ${money(p.price, { forceCents: true })}, cost ${money(p.cost as number, { forceCents: true })}. ${
        move.withOverhead
          ? "Covers cost, overhead share and a 30% margin."
          : "Covers cost and a 30% margin. Too few sales to count overhead in the price yet."
      }`,
      action: { label: "Change price", onClick: () => onSetPrice(p.id, move.suggested), primary: true },
    };
  })();

  // 3: what's not selling?
  const deadRow = (() => {
    if (dead.length === 0) return { title: "Everything sold in the last 30 days", detail: undefined };
    const names = dead
      .map((id) => products.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    const more = dead.length > 3 ? ` and ${dead.length - 3} more` : "";
    return {
      title: `${dead.length} ${dead.length === 1 ? "product hasn't" : "products haven't"} sold in 30 days`,
      detail: `${names}${more}.${tied > 0 ? ` ${money(tied)} of stock at cost is sitting on the shelf.` : ""}`,
      action:
        todo.length > 0
          ? { label: `Discount ${todo.length === 1 ? "it" : todo.length}`, onClick: () => onDiscount(todo.map((p) => p.id)), primary: true }
          : undefined,
    };
  })();

  return (
    <section aria-label="Your three answers" className="mt-8 sm:mt-10">
      <ul className="divide-y divide-line border-y border-line">
        <Row i={0} icon={<Receipt size={20} strokeWidth={1.75} aria-hidden />} {...profitRow} flashing={flash === "overhead"} />
        <Row i={1} icon={<Tag size={20} strokeWidth={1.75} aria-hidden />} {...priceRow} flashing={flash === "price"} />
        <Row i={2} icon={<PackageX size={20} strokeWidth={1.75} aria-hidden />} {...deadRow} flashing={flash === "dead"} />
      </ul>
      <p className="mt-3 text-xs text-muted">Calculated on this device from your own products. Works offline.</p>
    </section>
  );
}
