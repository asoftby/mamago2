"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardDraftStatus } from "@/lib/wizard/wizardDraftStorage";

/** «только что» / «N мин назад» / «N ч назад» */
export function formatRelativeTimeRu(date: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ч назад`;
}

export interface SaveIndicatorProps {
  status: WizardDraftStatus;
  lastSavedAt: Date | null;
  onRetry?: () => void;
  className?: string;
}

/**
 * Единый индикатор сохранения черновика для wizard-форм.
 * Ставится в `trailing` у FormWizardHeader. Источник состояний — useWizardDraft.
 */
export function SaveIndicator({
  status,
  lastSavedAt,
  onRetry,
  className,
}: SaveIndicatorProps) {
  // тик раз в 30с, чтобы относительное время не застывало
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== "saved" || !lastSavedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [status, lastSavedAt]);

  if (status === "saving") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Сохранение…
      </span>
    );
  }

  if (status === "saved" && lastSavedAt) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
        Черновик сохранён · {formatRelativeTimeRu(lastSavedAt)}
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-red-600", className)}>
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        Не сохранилось
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            Повторить
          </button>
        ) : null}
      </span>
    );
  }

  return null;
}
