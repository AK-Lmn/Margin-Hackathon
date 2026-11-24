"use client";
import { money } from "@/lib/format";
import { useCountUp, useTick } from "@/lib/use-count-up";
import type { Answer } from "@/lib/types";

type Props = { answer: Answer; onEditOverhead: () => void };

export function Hero({ answer, onEditOverhead }: Props) {
  const profit = Math.round(answer.trueProfit * 100) / 100;
  const shown = useCountUp(profit);
  const tick = useTick<HTMLParagraphElement>(profit);
  const noSales = answer.revenue === 0;
  const losing = answer.trueProfit < 0;

  const headline = noSales
    ? "No sales yet this month"
    : answer.beforeOverhead
      ? `Before overhead, you're ${losing ? "losing" : "making"} money`
      : `You're ${losing ? "losing" : "making"} money this month`;

  const tone = noSales ? "text-ink" : losing ? "text-loss" : "text-gain";

  return (
    <section aria-labelledby="hero-h" className="pt-6 sm:pt-10">
      <h1 id="hero-h" className="text-balance text-base font-medium text-muted sm:text-lg rise">
        {headline}
      </h1>
      <p
        ref={tick}
        className={`mt-1 font-semibold leading-none tracking-tight rise ${tone}`}
        style={{ fontSize: "clamp(3rem, 6vw + 1.5rem, 6rem)", "--i": 1 } as React.CSSProperties}
        aria-live="polite"
      >
        {money(shown, { signed: true })}
      </p>
      <p className="settle mt-3 max-w-prose text-sm leading-relaxed text-muted sm:text-base">
        {answer.beforeOverhead ? (
          <>
            {money(answer.revenue)} sales {"−"} {money(answer.productCosts)} product costs.{" "}
            <button
              onClick={onEditOverhead}
              className="press font-medium text-ink underline underline-offset-4 decoration-line hover:decoration-ink"
            >
              Add your monthly costs to see your true profit
            </button>
          </>
        ) : (
          <>
            {money(answer.revenue)} sales {"−"} {money(answer.productCosts)} product costs {"−"}{" "}
            {money(answer.overheadTotal)} overhead
          </>
        )}
      </p>
    </section>
  );
}
