const whole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/** $1,234 for whole amounts, $12.50 when there are cents. Uses a true minus sign. */
export function money(n: number, opts: { signed?: boolean; forceCents?: boolean } = {}): string {
  const abs = Math.abs(n);
  const isWhole = Math.abs(abs - Math.round(abs)) < 0.005;
  const body = (isWhole && !opts.forceCents ? whole : cents).format(abs);
  if (n < 0 && abs >= 0.005) return `−${body}`;
  if (opts.signed && abs >= 0.005) return `+${body}`;
  return body;
}

export function pct(n: number): string {
  const v = Math.round(n * 100);
  return `${v < 0 ? "−" : ""}${Math.abs(v)}%`;
}

export function daysSince(iso: string, now: Date): number | null {
  if (!iso) return null;
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
}
