"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type ToastData = { id: number; message: string; undo?: () => void };

const VISIBLE_MS = 8000;
const EXIT_MS = 160;

/**
 * A confirmation with an optional Undo. It stays while it is hovered or focused, Escape closes it,
 * and Ctrl+Z (Cmd+Z) undoes from anywhere, so keyboard users never have to race a timer to reach the button.
 */
export function Toast({ toast, onDone }: { toast: ToastData | null; onDone: () => void }) {
  const [closing, setClosing] = useState(false);
  const [paused, setPaused] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  const exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const close = useCallback(() => {
    setClosing(true);
    exitTimer.current = setTimeout(() => done.current(), EXIT_MS);
  }, []);

  useEffect(() => {
    clearTimeout(exitTimer.current);
    setClosing(false);
    setPaused(false);
  }, [toast?.id]);

  useEffect(() => {
    if (!toast || paused || closing) return;
    const t = setTimeout(close, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [toast, paused, closing, close]);

  useEffect(() => {
    if (!toast) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === "Escape") close();
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && toast.undo && !typing) {
        e.preventDefault();
        toast.undo();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toast, close]);

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role="status"
        data-state={closing ? "closing" : "open"}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
        }}
        className="toast pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink py-2 pl-5 pr-2 text-sm text-bg"
      >
        <span className="flex-1 py-2">{toast.message}</span>
        {toast.undo && (
          <button
            onClick={() => {
              toast.undo?.();
              close();
            }}
            aria-keyshortcuts="Control+Z Meta+Z"
            className="press min-h-11 rounded-full px-4 font-semibold underline underline-offset-4 hover:bg-bg/10"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
