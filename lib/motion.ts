/**
 * Motion rules, in one place. Every duration sits between 150 and 250ms, exits run about 20% faster
 * than entrances, and easing only slows down (no overshoot, no bounce). The CSS variables in
 * app/globals.css use the same numbers.
 */
export const COUNT_MS = 250; // value count-up and tick
export const TICK_MS = 150; // quick nudge when a figure changes
export const SETTLE_GRACE_MS = 100; // extra time before the count snaps to its true value if frames never run
export const TICK_SHIFT = 3; // pixels a changed figure drops in from
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

/** The number to show `elapsed` ms into a count from `origin` to `target`. Ease-out cubic: fast, then settles. */
export function countValue(origin: number, target: number, elapsed: number, duration: number): number {
  if (duration <= 0 || elapsed >= duration) return target;
  if (elapsed <= 0) return origin;
  const k = elapsed / duration;
  const eased = 1 - Math.pow(1 - k, 3);
  return origin + (target - origin) * eased;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
