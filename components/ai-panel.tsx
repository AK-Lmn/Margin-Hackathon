"use client";
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { explainShort, warmUpOnDevice, type AiResult } from "@/lib/ai";
import { duration } from "@/lib/format";
import { buildFacts, type ShortAnswers } from "@/lib/grounding";
import type { Overhead, Product } from "@/lib/types";

type State =
  | { s: "idle" }
  | { s: "loading" }
  | { s: "done"; r: AiResult<ShortAnswers>; ms: number }
  | { s: "error"; message: string };

export function AiPanel({ products, overhead, now }: { products: Product[]; overhead: Overhead | null; now: Date }) {
  const facts = useMemo(() => buildFacts(products, overhead, now), [products, overhead, now]);
  const key = JSON.stringify(facts);
  const [state, setState] = useState<State>({ s: "idle" });

  // Numbers changed: an old explanation would describe a shop that no longer exists.
  useEffect(() => setState({ s: "idle" }), [key]);

  // First touch anywhere starts loading the on-device model, so the button click is faster.
  useEffect(() => {
    const go = () => warmUpOnDevice();
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, []);

  async function run() {
    setState({ s: "loading" });
    const t0 = performance.now();
    try {
      const r = await explainShort(facts);
      setState({ s: "done", r, ms: performance.now() - t0 });
    } catch (e) {
      setState({ s: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  const badge =
    state.s === "done"
      ? `${state.r.source === "ON_DEVICE" ? "On-device · offline" : "Cloud"} · ${duration(state.ms)}`
      : null;

  return (
    <section aria-label="Plain-words explanation" className="mt-6">
      {state.s === "idle" && (
        <button
          onClick={run}
          className="press flex min-h-11 items-center gap-2 rounded-full border border-line px-5 text-sm font-semibold hover:bg-wash"
        >
          <Sparkles size={16} strokeWidth={1.75} aria-hidden /> Explain my numbers
        </button>
      )}

      {state.s === "loading" && (
        <div aria-busy="true" aria-live="polite">
          <p className="text-sm text-muted">Crunching your numbers&hellip;</p>
          <div className="mt-3 space-y-2">
            <div className="skeleton h-4 w-11/12" />
            <div className="skeleton h-4 w-9/12" />
            <div className="skeleton h-4 w-10/12" />
          </div>
        </div>
      )}

      {state.s === "error" && (
        <div role="alert" className="rise rounded-xl border border-loss/40 bg-loss-wash p-4">
          <p className="text-sm text-ink">{state.message}</p>
          <button onClick={run} className="press mt-3 min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-bg hover:bg-ink/85">
            Try again
          </button>
        </div>
      )}

      {state.s === "done" && (
        <div className="rise">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">In plain words</p>
            <p className="text-xs text-muted">{badge}</p>
          </div>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed sm:text-base">
            {[state.r.value.profit, state.r.value.price, state.r.value.dead].map((t, i) => (
              <li key={i} className="rise text-pretty" style={{ "--i": i } as React.CSSProperties}>
                {t}
              </li>
            ))}
          </ul>
          <button onClick={run} className="press mt-3 min-h-11 rounded-full px-3 text-sm font-medium text-muted hover:text-ink">
            Run again
          </button>
        </div>
      )}
    </section>
  );
}
