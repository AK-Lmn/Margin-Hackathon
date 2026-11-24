"use client";
import { useEffect, useRef, useState } from "react";
import { COUNT_MS, SETTLE_GRACE_MS, TICK_MS, TICK_SHIFT, EASE_OUT, countValue, prefersReducedMotion } from "./motion";

/**
 * Counts a number up from 0 when it first appears, then eases to each new value when it changes.
 * Snaps straight to the value when reduced motion is on.
 */
export function useCountUp(target: number, duration = COUNT_MS): number {
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      from.current = target;
      setValue(target);
      return;
    }
    if (from.current === target) return;
    const origin = from.current;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const v = countValue(origin, target, t - start, duration);
      from.current = v;
      setValue(v);
      if (v !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Animation frames pause in background tabs and some capture tools. The true value must still appear.
    const settle = setTimeout(() => {
      cancelAnimationFrame(raf);
      from.current = target;
      setValue(target);
    }, duration + SETTLE_GRACE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [target, duration]);

  return value;
}

/**
 * A quick nudge (small rise and fade-in) each time `value` changes after the first render, so a
 * figure that updated is easy to spot. Does nothing under reduced motion.
 */
export function useTick<T extends HTMLElement>(value: unknown) {
  const ref = useRef<T>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (prefersReducedMotion()) return;
    ref.current?.animate(
      [
        { transform: `translateY(${-TICK_SHIFT}px)`, opacity: 0.55 },
        { transform: "none", opacity: 1 },
      ],
      { duration: TICK_MS, easing: EASE_OUT },
    );
  }, [value]);

  return ref;
}
