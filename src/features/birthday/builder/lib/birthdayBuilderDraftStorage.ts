import type { BirthdayBuilderState } from "../types/builder";

const STORAGE_KEY = "mamago.birthdayBuilder.v1";

export function saveBirthdayBuilderDraft(state: BirthdayBuilderState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / private mode
  }
}

export function loadBirthdayBuilderDraft(): BirthdayBuilderState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BirthdayBuilderState;
    if (!parsed || typeof parsed !== "object" || !parsed.quiz || !parsed.ui) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearBirthdayBuilderDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
