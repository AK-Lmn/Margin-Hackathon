"use client";
import { useMemo, useRef, useState } from "react";
import { avgUnitMargin } from "@/lib/margin";
import { money } from "@/lib/format";
import type { Answer, Product } from "@/lib/types";

type Props = { products: Product[]; answer: Answer };

/**
 * Profit as units sell. Solid = where you are now, dashed = if the same mix keeps selling.
 * Built only from the seller's own prices, costs and overhead.
 */
export function ProfitChart({ products, answer }: Props) {
  const margin = avgUnitMargin(products);
  const sold = products.filter((p) => p.cost !== null).reduce((s, p) => s + p.sold, 0);
  const base = -answer.overheadTotal;
  const be = answer.breakEvenUnits;

  const [scrub, setScrub] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const g = useMemo(() => {
    const m = margin ?? 0;
    const xMax = Math.max(sold, be ?? 0, 10) * 1.3;
    const at = (u: number) => base + m * u;
    const vals = [at(0), at(xMax), 0];
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const pad = Math.max((hi - lo) * 0.14, 1);
    lo -= pad;
    hi += pad;
    const fx = (u: number) => (u / xMax) * 100;
    const fy = (v: number) => ((hi - v) / (hi - lo)) * 100;
    return { xMax, at, fx, fy };
  }, [margin, sold, be, base]);

  if (margin === null) {
    return (
      <p className="py-10 text-sm text-muted">
        Add a cost to at least one product to see how profit grows as you sell.
      </p>
    );
  }

  const color = answer.trueProfit < 0 ? "var(--loss)" : "var(--gain)";
  const solidEnd = Math.min(sold, g.xMax);
  const line = (a: number, b: number) =>
    `M ${g.fx(a)} ${g.fy(g.at(a))} L ${g.fx(b)} ${g.fy(g.at(b))}`;

  const units = scrub ?? sold;
  const profitAt = g.at(units);

  const setFromX = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const k = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setScrub(Math.round(k * g.xMax));
  };

  const readout =
    scrub !== null
      ? `${scrub} units: ${money(profitAt, { signed: true })}`
      : be === null
        ? answer.beforeOverhead
          ? "Profit before overhead as units sell"
          : "Your average sale doesn't cover overhead yet"
        : sold >= be
          ? `${sold} sold. You passed break-even at ${be} units`
          : `Sell ${be - sold} more units to break even (${be} total)`;

  return (
    <section aria-label="Profit as units sell" className="mt-6 sm:mt-8">
      <p className="min-h-6 text-sm font-medium sm:text-base" aria-live="off">
        <span className={scrub !== null ? "text-ink" : "text-muted"}>{readout}</span>
      </p>

      <div
        ref={box}
        role="slider"
        tabIndex={0}
        aria-label="Units sold"
        aria-valuemin={0}
        aria-valuemax={Math.round(g.xMax)}
        aria-valuenow={Math.round(units)}
        aria-valuetext={`${Math.round(units)} units, profit ${money(profitAt, { signed: true })}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId) || e.pointerType === "mouse") setFromX(e.clientX);
        }}
        onPointerUp={() => setScrub(null)}
        onPointerCancel={() => setScrub(null)}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setScrub(null);
        }}
        onBlur={() => setScrub(null)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 1;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") setScrub(Math.min(Math.round(g.xMax), Math.round(units) + step));
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") setScrub(Math.max(0, Math.round(units) - step));
          else if (e.key === "Escape") setScrub(null);
          else return;
          e.preventDefault();
        }}
        className="relative mt-2 h-44 cursor-crosshair select-none sm:h-60 lg:h-72"
        style={{ touchAction: "pan-y" }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="draw absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <line x1="0" x2="100" y1={g.fy(0)} y2={g.fy(0)} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="2 4" />
          {be !== null && be <= g.xMax && (
            <line x1={g.fx(be)} x2={g.fx(be)} y1="0" y2="100" stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          )}
          {g.xMax > solidEnd && (
            <path d={line(solidEnd, g.xMax)} fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
          {solidEnd > 0 && (
            <path d={line(0, solidEnd)} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        <span className="pointer-events-none absolute left-0 -translate-y-full pb-1 text-xs text-muted" style={{ top: `${g.fy(0)}%` }}>
          $0
        </span>
        {be !== null && be <= g.xMax && (
          <span className="pointer-events-none absolute top-0 -translate-x-1/2 text-xs text-muted" style={{ left: `${Math.min(88, Math.max(12, g.fx(be)))}%` }}>
            break even
          </span>
        )}

        <span
          className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg"
          style={{ left: `${g.fx(units)}%`, top: `${g.fy(profitAt)}%`, background: color }}
        />
        {scrub !== null && (
          <span className="pointer-events-none absolute inset-y-0 w-px bg-ink/30" style={{ left: `${g.fx(scrub)}%` }} />
        )}
      </div>

      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>0 units</span>
        <span>{Math.round(g.xMax)} units</span>
      </div>
    </section>
  );
}
