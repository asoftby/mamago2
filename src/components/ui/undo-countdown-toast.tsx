"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type UndoCountdownToastContentProps = {
  toastId: string | number;
  message: string;
  durationMs: number;
  undoLabel: string;
  onUndo: () => void;
};

/**
 * Тело toast для отложенного удаления: текст + обратный отсчёт + «Отменить».
 */
export function UndoCountdownToastContent({
  toastId,
  message,
  durationMs,
  undoLabel,
  onUndo,
}: UndoCountdownToastContentProps) {
  const [secLeft, setSecLeft] = useState(() =>
    Math.max(0, Math.ceil(durationMs / 1000)),
  );

  useEffect(() => {
    const end = Date.now() + durationMs;
    const tick = () => {
      setSecLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [durationMs]);

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-2 rounded-lg border border-neutral-200/90 p-3 shadow-md"
      style={{ backgroundColor: "#ffffff" }}
    >
      <p className="text-sm font-medium leading-snug text-neutral-900">{message}</p>
      <div className="flex items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-neutral-600" aria-live="polite">
          <span>Удалю окончательно через:</span>
          <span
            className={cn(
              "inline-flex min-w-[4rem] justify-center rounded-md border border-neutral-200",
              "px-2 py-0.5 font-semibold tabular-nums text-neutral-900 shadow-sm",
            )}
            style={{ backgroundColor: "#ffffff" }}
          >
            {secLeft} сек
          </span>
        </p>
        <button
          type="button"
          className={cn(
            "shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium",
            "text-primary-foreground hover:bg-primary/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          onClick={() => {
            onUndo();
            toast.dismiss(toastId);
          }}
        >
          {undoLabel}
        </button>
      </div>
    </div>
  );
}
