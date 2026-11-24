"use client";
import { useState } from "react";
import { Collapse } from "./collapse";
import { Field } from "./field";
import { money } from "@/lib/format";
import { overheadTotal } from "@/lib/margin";
import type { Overhead } from "@/lib/types";

type Props = {
  overhead: Overhead | null;
  open: boolean;
  setOpen: (o: boolean) => void;
  onSave: (o: Overhead) => void;
};

const KEYS: { k: keyof Overhead; label: string }[] = [
  { k: "rent", label: "Rent" },
  { k: "bills", label: "Electricity, water, internet" },
  { k: "supplies", label: "Packaging and supplies" },
  { k: "salaries", label: "Staff pay (0 if solo)" },
];

function Form({ overhead, onSave, onCancel }: { overhead: Overhead | null; onSave: (o: Overhead) => void; onCancel: () => void }) {
  const [f, setF] = useState<Record<keyof Overhead, string>>({
    rent: overhead ? String(overhead.rent) : "",
    bills: overhead ? String(overhead.bills) : "",
    supplies: overhead ? String(overhead.supplies) : "",
    salaries: overhead ? String(overhead.salaries) : "",
  });
  const [err, setErr] = useState<Partial<Record<keyof Overhead, string>>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const out = {} as Overhead;
    const errs: typeof err = {};
    for (const { k } of KEYS) {
      const raw = f[k].trim();
      const n = raw === "" ? 0 : Number(raw);
      if (!Number.isFinite(n) || n < 0) errs[k] = "Enter 0 or more";
      else out[k] = n;
    }
    setErr(errs);
    if (Object.keys(errs).length === 0) onSave(out);
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 pt-3 min-[420px]:grid-cols-2">
      {KEYS.map(({ k, label }) => (
        <Field key={k} label={label} prefix="$" value={f[k]} onChange={(v) => setF((s) => ({ ...s, [k]: v }))} error={err[k]} placeholder="0" />
      ))}
      <div className="flex gap-2 min-[420px]:col-span-2">
        <button type="submit" className="press min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-bg hover:bg-ink/85">
          Save monthly costs
        </button>
        <button type="button" onClick={onCancel} className="press min-h-11 rounded-full px-4 text-sm font-medium text-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function OverheadEditor({ overhead, open, setOpen, onSave }: Props) {
  const total = overheadTotal(overhead);
  return (
    <section id="overhead" aria-labelledby="oh-h" className="border-t border-line pt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="oh-h" className="text-lg font-semibold">Monthly costs</h2>
          <p className="text-sm text-muted">{total === null ? "Not entered yet" : `${money(total)} a month`}</p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="press min-h-11 rounded-full border border-line px-4 text-sm font-semibold hover:bg-wash"
        >
          {open ? "Close" : total === null ? "Add" : "Edit"}
        </button>
      </div>
      <Collapse open={open}>
        {open && <Form overhead={overhead} onSave={onSave} onCancel={() => setOpen(false)} />}
      </Collapse>
    </section>
  );
}
