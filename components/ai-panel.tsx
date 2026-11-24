"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { CloudConsentError, explainShort, warmUpOnDevice, type AiResult } from "@/lib/ai";
import { duration } from "@/lib/format";
import { buildFacts, type ShortAnswers } from "@/lib/grounding";
import type { Overhead, Product } from "@/lib/types";

type State =
  | { s: "idle" }
  | { s: "loading"; t0: number }
  | { s: "done"; r: AiResult<ShortAnswers>; ms: number }
  | { s: "consent" }
  | { s: "error"; message: string };

const CONSENT_KEY = "margin:cloud-ok";

/** Live stopwatch. Hidden from screen readers so it doesn't announce every tick. */
function Elapsed({ since }: { since: number }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMs(performance.now() - since), 100);
    return () => clearInterval(id);
  }, [since]);
  return (
    <span aria-hidden className="tabular-nums">
      {duration(ms)}
    </span>
  );
}

export function AiPanel({ products, overhead, now }: { products: Product[]; overhead: Overhead | null; now: Date }) {
  const facts = useMemo(() => buildFacts(products, overhead, now), [products, overhead, now]);
  const key = JSON.stringify(facts);
  const [state, setState] = useState<State>({ s: "idle" });
  const [cloudOk, setCloudOk] = useState(false);
  // Bumped whenever the shop changes, so an answer that was still loading is thrown away.
  const run_id = useRef(0);

  useEffect(() => {
    run_id.current += 1;
    setState({ s: "idle" });
  }, [key]);

  useEffect(() => {
    try {
      setCloudOk(localStorage.getItem(CONSENT_KEY) === "1");
    } catch {
      /* storage blocked: ask each time */
    }
  }, []);

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

  async function run(allowCloud = cloudOk) {
    const id = ++run_id.current;
    const t0 = performance.now();
    setState({ s: "loading", t0 });
    try {
      const r = await explainShort(facts, allowCloud);
      if (id === run_id.current) setState({ s: "done", r, ms: performance.now() - t0 });
    } catch (e) {
      if (id !== run_id.current) return;
      if (e instanceof CloudConsentError) setState({ s: "consent" });
      else setState({ s: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  function agreeToCloud() {
    setCloudOk(true);
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      /* fine: the choice lasts for this visit */
    }
    void run(true);
  }

  const badge =
    state.s === "done"
      ? `${state.r.source === "ON_DEVICE" ? "On-device · offline" : "Cloud"} · ${duration(state.ms)}`
      : null;

  return (
    <section aria-label="Plain-words explanation" className="mt-6">
      {state.s === "idle" && (
        <button
          onClick={() => run()}
          className="press flex min-h-11 items-center gap-2 rounded-full border border-line px-5 text-sm font-semibold hover:bg-wash"
        >
          <Sparkles size={16} strokeWidth={1.75} aria-hidden /> Explain my numbers
        </button>
      )}

      {state.s === "loading" && (
        <div aria-busy="true" aria-live="polite">
          <p className="flex items-baseline justify-between gap-3 text-sm text-muted">
            <span>Crunching your numbers&hellip;</span>
            <Elapsed since={state.t0} />
          </p>
          <div className="mt-3 space-y-2">
            <div className="skeleton h-4 w-11/12" />
            <div className="skeleton h-4 w-9/12" />
            <div className="skeleton h-4 w-10/12" />
          </div>
        </div>
      )}

      {state.s === "consent" && (
        <div role="alert" className="rise rounded-xl border border-line bg-wash p-4">
          <p className="text-sm text-ink">
            On-device AI isn&apos;t available in this browser. A cloud model can explain your numbers instead, but it
            would receive your product names, costs and prices.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={agreeToCloud} className="press min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-bg hover:bg-ink/85">
              Use the cloud model
            </button>
            <button onClick={() => setState({ s: "idle" })} className="press min-h-11 rounded-full px-4 text-sm font-medium text-muted hover:text-ink">
              Not now
            </button>
          </div>
        </div>
      )}

      {state.s === "error" && (
        <div role="alert" className="rise rounded-xl border border-loss/40 bg-loss-wash p-4">
          <p className="text-sm text-ink">{state.message}</p>
          <button onClick={() => run()} className="press mt-3 min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-bg hover:bg-ink/85">
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
          <button onClick={() => run()} className="press mt-3 min-h-11 rounded-full px-3 text-sm font-medium text-muted hover:text-ink">
            Run again
          </button>
        </div>
      )}
    </section>
  );
}
