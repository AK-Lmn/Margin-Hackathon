"use client";
import { useId } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  inputMode?: "decimal" | "numeric" | "text";
  type?: string;
  placeholder?: string;
  prefix?: string;
};

export function Field({ label, value, onChange, error, hint, inputMode = "decimal", type = "text", placeholder, prefix }: Props) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
        {label}
      </label>
      <div
        className={`flex min-h-11 items-center rounded-lg border bg-bg px-3 transition-colors focus-within:border-ink ${
          error ? "border-loss" : "border-line"
        }`}
      >
        {prefix && <span className="mr-1 text-muted">{prefix}</span>}
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          type={type}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-d` : undefined}
          className="w-full min-w-0 bg-transparent py-2 text-base outline-none placeholder:text-muted/70"
        />
      </div>
      {(error || hint) && (
        <p id={`${id}-d`} className={`mt-1 text-xs ${error ? "text-loss" : "text-muted"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
