"use client";
import { useEffect, useState } from "react";

export type ToastData = { id: number; message: string; undo?: () => void };

export function Toast({ toast, onDone }: { toast: ToastData | null; onDone: () => void }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setClosing(false);
    const a = setTimeout(() => setClosing(true), 6000);
    const b = setTimeout(onDone, 6160);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  if (!toast) return null;
  const close = () => {
    setClosing(true);
    setTimeout(onDone, 160);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role="status"
        data-state={closing ? "closing" : "open"}
        className="toast pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink py-2 pl-5 pr-2 text-sm text-bg shadow-[0_8px_24px_-6px_rgba(13,18,16,0.35)]"
      >
        <span className="flex-1 py-2">{toast.message}</span>
        {toast.undo && (
          <button
            onClick={() => {
              toast.undo?.();
              close();
            }}
            className="press min-h-11 rounded-full px-4 font-semibold underline underline-offset-4 hover:bg-bg/10"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
