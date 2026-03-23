const PENDING_KEY = "mamagoBirthdayBuilderPending";

export type PendingBirthdayBuilderAction =
  | { type: "selectBase"; offerId: string }
  | { type: "toggleAddon"; offerId: string };

export function setPendingBirthdayBuilderAction(action: PendingBirthdayBuilderAction): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(action));
  } catch {
    /* noop */
  }
}

export function clearPendingBirthdayBuilderAction(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* noop */
  }
}

export function consumePendingBirthdayBuilderAction(): PendingBirthdayBuilderAction | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingBirthdayBuilderAction;
    window.sessionStorage.removeItem(PENDING_KEY);
    if (
      parsed?.type === "selectBase" &&
      typeof parsed.offerId === "string"
    ) {
      return parsed;
    }
    if (
      parsed?.type === "toggleAddon" &&
      typeof parsed.offerId === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
