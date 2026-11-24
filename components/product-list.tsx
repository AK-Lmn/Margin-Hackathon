"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Collapse } from "./collapse";
import { Field } from "./field";
import { daysSince, money, pct } from "@/lib/format";
import { marginPct } from "@/lib/margin";
import type { Product } from "@/lib/types";

type Props = {
  products: Product[];
  deadIds: string[];
  now: Date;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onSave: (p: Product, isNew: boolean) => void;
  onDelete: (id: string) => void;
};

const blank = (): Product => ({ id: "", name: "", cost: null, price: 0, stock: 0, sold: 0, lastSoldDate: "" });

function Editor({ initial, isNew, onSave, onDelete, onCancel }: {
  initial: Product; isNew: boolean;
  onSave: (p: Product) => void; onDelete: () => void; onCancel: () => void;
}) {
  const [f, setF] = useState({
    name: initial.name,
    cost: initial.cost === null ? "" : String(initial.cost),
    price: isNew ? "" : String(initial.price),
    stock: String(initial.stock),
    sold: String(initial.sold),
    last: initial.lastSoldDate,
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const e2: Record<string, string> = {};
    const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
    const price = num(f.price), cost = f.cost.trim() === "" ? null : num(f.cost);
    const stock = num(f.stock), sold = num(f.sold);
    if (!f.name.trim()) e2.name = "Give it a name";
    if (!Number.isFinite(price) || price < 0) e2.price = "Enter a price of 0 or more";
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) e2.cost = "Cost can't be negative";
    if (!Number.isInteger(stock) || stock < 0) e2.stock = "Whole number, 0 or more";
    if (!Number.isInteger(sold) || sold < 0) e2.sold = "Whole number, 0 or more";
    if (sold > 0 && !f.last) e2.last = "Add the date of the last sale";
    setErr(e2);
    if (Object.keys(e2).length) return;
    onSave({
      ...initial,
      name: f.name.trim(), cost, price, stock, sold,
      lastSoldDate: sold === 0 && !f.last ? "" : f.last,
      discountedFrom: price === initial.price ? initial.discountedFrom : undefined,
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-2 gap-3 border-t border-line bg-wash/60 p-4 sm:grid-cols-3">
      <div className="col-span-2 sm:col-span-3">
        <Field label="Name" value={f.name} onChange={set("name")} error={err.name} inputMode="text" placeholder="Phone case" />
      </div>
      <Field label="You pay (cost)" prefix="$" value={f.cost} onChange={set("cost")} error={err.cost} hint={f.cost === "" ? "Blank = unknown" : undefined} />
      <Field label="You charge" prefix="$" value={f.price} onChange={set("price")} error={err.price} />
      <Field label="In stock" value={f.stock} onChange={set("stock")} error={err.stock} inputMode="numeric" />
      <Field label="Sold this month" value={f.sold} onChange={set("sold")} error={err.sold} inputMode="numeric" />
      <div className="col-span-2 sm:col-span-2">
        <Field label="Last sale" type="date" value={f.last} onChange={set("last")} error={err.last} inputMode="text" hint={f.last ? undefined : "Blank = never sold"} />
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-2 pt-1 sm:col-span-3">
        <button type="submit" className="press min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-bg hover:bg-ink/85">
          {isNew ? "Add product" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="press min-h-11 rounded-full px-4 text-sm font-medium text-muted hover:text-ink">
          Cancel
        </button>
        {!isNew && (
          <button type="button" onClick={onDelete} className="press ml-auto flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-loss hover:bg-loss-wash">
            <Trash2 size={16} strokeWidth={1.75} aria-hidden /> Delete
          </button>
        )}
      </div>
    </form>
  );
}

export function ProductList({ products, deadIds, now, openId, setOpenId, onSave, onDelete }: Props) {
  const dead = new Set(deadIds);
  return (
    <section aria-labelledby="prod-h">
      <div className="flex items-center justify-between">
        <h2 id="prod-h" className="text-lg font-semibold">Products</h2>
        <button
          onClick={() => setOpenId(openId === "new" ? null : "new")}
          className="press flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold hover:bg-wash"
        >
          <Plus size={16} strokeWidth={2} aria-hidden /> Add
        </button>
      </div>

      <Collapse open={openId === "new"}>
        {openId === "new" && (
          <div className="mt-2 overflow-hidden rounded-xl border border-line">
            <Editor initial={blank()} isNew onSave={(p) => onSave(p, true)} onDelete={() => {}} onCancel={() => setOpenId(null)} />
          </div>
        )}
      </Collapse>

      <table className="mt-2 w-full border-collapse text-left">
        <caption className="sr-only">Your products with price and margin</caption>
        <thead>
          <tr className="text-xs text-muted">
            <th scope="col" className="py-2 pr-2 font-medium">Product</th>
            <th scope="col" className="py-2 px-2 text-right font-medium">Price</th>
            <th scope="col" className="py-2 pl-2 text-right font-medium">Margin</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => {
            const m = marginPct(p);
            const below = p.cost !== null && p.price < p.cost;
            const idle = daysSince(p.lastSoldDate, now);
            const open = openId === p.id;
            return (
              <tr key={p.id} className="border-t border-line align-top">
                <td colSpan={3} className="p-0">
                  <button
                    onClick={() => setOpenId(open ? null : p.id)}
                    aria-expanded={open}
                    className="rise press grid min-h-14 w-full grid-cols-[1fr_auto_auto] items-center gap-x-4 py-2.5 text-left hover:bg-wash/60"
                    style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                  >
                    <span className="min-w-0">
                      <span className="block text-base font-medium [overflow-wrap:anywhere]">{p.name}</span>
                      <span className="block text-pretty text-xs leading-relaxed text-muted">
                        {p.cost === null ? "cost unknown" : `cost ${money(p.cost, { forceCents: true })}`} · {p.stock} in stock · {p.sold} sold
                        {dead.has(p.id) && ` · ${idle === null ? "never sold" : `no sale in ${idle} days`}`}
                      </span>
                    </span>
                    <span className="text-right text-base">
                      {money(p.price, { forceCents: true })}
                      {p.discountedFrom !== undefined && (
                        <span className="block text-xs text-muted line-through">{money(p.discountedFrom, { forceCents: true })}</span>
                      )}
                    </span>
                    <span className="w-16 text-right text-sm font-medium sm:w-20">
                      {p.cost === null ? (
                        <span className="text-muted underline underline-offset-4">Add cost</span>
                      ) : m === null ? (
                        <span className="text-muted">n/a</span>
                      ) : below ? (
                        <span className="text-loss">{pct(m)}<span className="block text-xs font-normal">below cost</span></span>
                      ) : (
                        <span className="text-gain">{pct(m)}</span>
                      )}
                    </span>
                  </button>
                  <Collapse open={open}>
                    {open && (
                      <Editor
                        initial={p}
                        isNew={false}
                        onSave={(np) => onSave(np, false)}
                        onDelete={() => onDelete(p.id)}
                        onCancel={() => setOpenId(null)}
                      />
                    )}
                  </Collapse>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
