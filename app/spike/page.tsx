"use client";
import { useState } from "react";
import { cloudModel, CLOUD_MODEL, onDeviceModel } from "@/lib/firebase";

type Log = { t: string; msg: string };

/** Throwaway page: does Nano run here, and does cloud fallback work? Delete before submission. */
export default function Spike() {
  const [log, setLog] = useState<Log[]>([]);
  const [busy, setBusy] = useState(false);
  const add = (msg: string) => setLog((l) => [...l, { t: new Date().toLocaleTimeString(), msg }]);

  const prompt = "Reply with exactly: OK. Then one short sentence saying which kind of model you are.";

  async function run(forceCloud: boolean) {
    setBusy(true);
    setLog([]);
    try {
      if (!forceCloud) {
        try {
          add("Initializing on-device model (may download)...");
          const m = onDeviceModel();
          await m.initializeDeviceModel((p) => add(`download ${Math.round(p * 100)}%`));
          const r = await m.generateContent(prompt);
          add(`source=${r.response.inferenceSource} text=${r.response.text()}`);
          return;
        } catch (e) {
          add(`on-device failed: ${e instanceof Error ? e.message : String(e)}`);
          add("Falling back to cloud...");
        }
      }
      const r = await cloudModel().generateContent(prompt);
      add(`source=${r.response.inferenceSource} model=${CLOUD_MODEL} text=${r.response.text()}`);
    } catch (e) {
      add(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Firebase AI spike</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        <button disabled={busy} onClick={() => run(false)} className="press min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-bg disabled:opacity-50">
          Try on-device, then cloud
        </button>
        <button disabled={busy} onClick={() => run(true)} className="press min-h-11 rounded-full border border-line px-5 text-sm font-semibold disabled:opacity-50">
          Force cloud
        </button>
      </div>
      <pre className="mt-6 whitespace-pre-wrap break-words rounded-lg bg-wash p-4 text-sm" aria-live="polite">
        {log.length === 0 ? "No run yet." : log.map((l) => `${l.t}  ${l.msg}`).join("\n")}
      </pre>
    </main>
  );
}
