"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DELAY_MS = 10_000;
const DEFAULT_SUPPRESS_MS = 24 * 60 * 60 * 1000;

type UseDelayedPlanPromptAfterExternalActionOptions = {
  entityType: "EVENT";
  entityId: string;
  isInPlan: boolean;
  delayMs?: number;
  enabled?: boolean;
  promptKey?: string;
  suppressMs?: number;
};

function buildPromptKey(entityType: "EVENT", entityId: string) {
  return `mamago:delayed-plan-prompt:${entityType}:${entityId}`;
}

function canShowPrompt(storageKey: string, suppressMs: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return true;
    const lastDismissedAt = Number(raw);
    if (!Number.isFinite(lastDismissedAt)) return true;
    return Date.now() - lastDismissedAt >= suppressMs;
  } catch {
    return true;
  }
}

function persistDismissal(storageKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, String(Date.now()));
  } catch {
    // ignore storage failures
  }
}

export function useDelayedPlanPromptAfterExternalAction({
  entityType,
  entityId,
  isInPlan,
  delayMs = DEFAULT_DELAY_MS,
  enabled = true,
  promptKey,
  suppressMs = DEFAULT_SUPPRESS_MS,
}: UseDelayedPlanPromptAfterExternalActionOptions) {
  const storageKey = promptKey ?? buildPromptKey(entityType, entityId);
  const [rawOpen, setRawOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const latestIsInPlanRef = useRef(isInPlan);
  const latestEnabledRef = useRef(enabled);

  useEffect(() => {
    latestIsInPlanRef.current = isInPlan;
  }, [isInPlan]);

  useEffect(() => {
    latestEnabledRef.current = enabled;
  }, [enabled]);

  const clearPromptTimer = useCallback(() => {
    if (timerRef.current != null && typeof window !== "undefined") {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const triggerPrompt = useCallback(() => {
    clearPromptTimer();
    if (typeof window === "undefined") return;
    if (!latestEnabledRef.current || latestIsInPlanRef.current) return;
    if (!canShowPrompt(storageKey, suppressMs)) return;

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (!latestEnabledRef.current || latestIsInPlanRef.current) return;
      if (!canShowPrompt(storageKey, suppressMs)) return;
      setRawOpen(true);
    }, delayMs);
  }, [clearPromptTimer, delayMs, storageKey, suppressMs]);

  const dismissPrompt = useCallback(() => {
    clearPromptTimer();
    persistDismissal(storageKey);
    setRawOpen(false);
  }, [clearPromptTimer, storageKey]);

  const acceptPrompt = useCallback(() => {
    clearPromptTimer();
    setRawOpen(false);
  }, [clearPromptTimer]);

  useEffect(() => {
    if (!isInPlan) return;
    clearPromptTimer();
  }, [clearPromptTimer, isInPlan]);

  useEffect(() => {
    if (enabled) return;
    clearPromptTimer();
  }, [clearPromptTimer, enabled]);

  useEffect(() => clearPromptTimer, [clearPromptTimer]);

  return {
    open: rawOpen && enabled && !isInPlan,
    triggerPrompt,
    dismissPrompt,
    acceptPrompt,
    setOpen: setRawOpen,
  };
}
