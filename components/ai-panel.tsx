"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Cloud, Copy, Cpu, Sparkles } from "lucide-react";
import { CloudConsentError, explainShort, warmUpOnDevice, type AiResult } from "@/lib/ai";
import { duration } from "@/lib/format";
import { buildFacts, type ShortAnswers } from "@/lib/grounding";
import type { Overhead, Product } from "@/lib/types";

type State =
  | { s: "idle" }
  | { s: "loading"; t0: number }
  | { s: "done"; r: AiResult<ShortAnswers>; ms: number }
  | { s: "consent"; reason: string }
  | { s: "error"; message: string };

const CONSENT_KEY = "margin:cloud-ok";
const FLAG_URL = "chrome://flags/#prompt-api-for-gemini-nano-multimodal-input";

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

/** Slides its content open (height and fade, same timing as the forms) when it appears. */
function Reveal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Read the closed layout once so the browser registers it, then open: the transition runs without
    // waiting for an animation frame (frames pause in background tabs and the answer must still appear).
    box.current?.getBoundingClientRect();
    setOpen(true);
  }, []);
  return (
    <div ref={box} className="expander" data-open={open}>
      <div>{children}</div>
    </div>
  );
}

/** Which model really answered, read from the SDK. Shown on every AI answer. */
function SourceBadge({ source, ms }: { source: "ON_DEVICE" | "IN_CLOUD"; ms: number }) {
  const onDevice = source === "ON_DEVICE";
  const Icon = onDevice ? Cpu : Cloud;
  return (
    <p
      className="flex items-center gap-1.5 rounded-full border border-field px-3 py-1 text-sm font-medium"
      aria-label={`${onDevice ? "Answered on this device, no data sent" : "Answered by Google's cloud model"}, ${duration(ms)}`}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden />
      <span>{onDevice ? "On-device · offline" : "Cloud · Google Gemini"}</span>
      <span className="text-muted tabular-nums">{duration(ms)}</span>
    </p>
  );
}

/** Exact steps to get Chrome's built-in model running. */
function OnDeviceHelp() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(FLAG_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address is on screen to copy by hand */
    }
  };
  return (
    <div className="mt-3 text-sm leading-relaxed text-ink">
      <p className="font-semibold">To run it on your device (desktop Chrome 139 or newer):</p>
      <ol className="mt-1.5 list-decimal space-y-1.5 pl-5">
        <li>
          Open this address and set the flag to <strong>Enabled</strong>:
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-bg px-1.5 py-0.5 text-xs">{FLAG_URL}</code>
            <button
              onClick={copy}
              className="press flex min-h-11 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold hover:bg-bg"
            >
              {copied ? <Check size={14} strokeWidth={2} aria-hidden /> : <Copy size={14} strokeWidth={1.75} aria-hidden />}
              {copied ? "Copied" : "Copy address"}
            </button>
          </span>
        </li>
        <li>Relaunch Chrome.</li>
        <li>
          Open <code className="rounded bg-bg px-1.5 py-0.5 text-xs">chrome://components</code>, find{" "}
          <em>Optimization Guide On Device Model</em> and click <em>Check for update</em>. Wait until it shows a version
          number.
        </li>
        <li>Come back here and click Explain my numbers again. The first run downloads the model, so it can take a minute.</li>
      </ol>
    </div>
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
      if (e instanceof CloudConsentError) setState({ s: "consent", reason: e.reason });
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
        <Reveal>
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
        </Reveal>
      )}

      {state.s === "consent" && (
        <Reveal>
        <div role="alert" className="rounded-xl border border-line bg-wash p-4">
          <p className="text-sm font-semibold text-ink">On-device AI isn&apos;t available in this browser.</p>
          {state.reason && !/not available in this browser/i.test(state.reason) && (
            <p className="mt-1 break-words text-xs text-muted">Browser said: {state.reason}</p>
          )}
          <OnDeviceHelp />
          <p className="mt-4 text-sm text-ink">
            Or use the cloud model instead. It would receive your product names, costs and prices.
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
        </Reveal>
      )}

      {state.s === "error" && (
        <Reveal>
        <div role="alert" className="rounded-xl border border-loss/40 bg-loss-wash p-4">
          <p className="text-sm text-ink">{state.message}</p>
          {/offline/i.test(state.message) && <OnDeviceHelp />}
          <button onClick={() => run()} className="press mt-3 min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-bg hover:bg-ink/85">
            Try again
          </button>
        </div>
        </Reveal>
      )}

      {state.s === "done" && (
        <Reveal>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="text-sm font-semibold">In plain words</p>
            <SourceBadge source={state.r.source} ms={state.ms} />
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
        </Reveal>
      )}
    </section>
  );
}
