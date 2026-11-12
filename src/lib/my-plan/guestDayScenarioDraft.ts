import { buildSaveBody, SAVE_FAILURE_TEXT, saveFailureOf, type DraftItem, type SaveFailure } from "@/features/my-plan/lib/dayScenarioUi/model";

/**
 * A guest's day-scenario draft that must survive sign-in or registration (BACKLOG-230, PR 3c-2). «Сохранить» as a guest
 * stores the shown day(s) here and sends the guest to the auth page; the post-auth pipeline saves it as soon as the
 * user is signed in (one save, same transaction and Idempotency-Key as a member's), then forgets it. A draft older than a
 * day is dropped: the day it was built for has moved on.
 */

export const GUEST_DAY_SCENARIO_DRAFT_KEY = "mamago:guestDayScenarioDraft:v1";
export const GUEST_DAY_SCENARIO_DRAFT_TTL_MS = 24 * 3_600_000;

type SaveBody = ReturnType<typeof buildSaveBody>;
export type GuestDayScenarioDraft = { v: 1; savedAt: number; idempotencyKey: string; body: SaveBody };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[A-Za-z0-9:_-]{8,200}$/;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Is the stored value a draft this version wrote? Anything else is ignored, never saved. */
export function parseGuestDayScenarioDraft(raw: string | null, now: number): GuestDayScenarioDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<GuestDayScenarioDraft>;
    if (!value || value.v !== 1 || typeof value.savedAt !== "number" || typeof value.idempotencyKey !== "string" || !KEY.test(value.idempotencyKey)) return null;
    if (now - value.savedAt > GUEST_DAY_SCENARIO_DRAFT_TTL_MS || value.savedAt > now + 60_000) return null;
    const days = value.body?.days;
    if (!Array.isArray(days) || days.length < 1 || days.length > 2) return null;
    for (const day of days) {
      if (!day || typeof day.date !== "string" || !DATE.test(day.date) || !Array.isArray(day.items) || day.items.length < 1 || day.items.length > 4) return null;
      for (const item of day.items) {
        if (!item || (item.kind !== "event" && item.kind !== "place") || typeof item.activityId !== "string" || !item.activityId || typeof item.startsAt !== "string" || typeof item.endsAt !== "string") return null;
      }
    }
    return value as GuestDayScenarioDraft;
  } catch {
    return null;
  }
}

/** Stores the shown day(s). Returns false when storage is unavailable (private mode): the caller says so instead of sending the guest away. */
export function writeGuestDayScenarioDraft(days: readonly { date: string; items: readonly DraftItem[] }[], storage: StorageLike | null, now: number, idempotencyKey: string): boolean {
  if (!storage) return false;
  const body = buildSaveBody(days.filter((day) => day.items.length > 0));
  if (body.days.length === 0) return false;
  try {
    storage.setItem(GUEST_DAY_SCENARIO_DRAFT_KEY, JSON.stringify({ v: 1, savedAt: now, idempotencyKey, body } satisfies GuestDayScenarioDraft));
    return true;
  } catch {
    return false;
  }
}

export type GuestDraftOutcome =
  | { kind: "none" }
  | { kind: "saved"; dates: string[] }
  /** The server said no for good (a clash, a past day, a changed point): the draft is dropped and the user is told why. */
  | { kind: "rejected"; failure: SaveFailure; message: string }
  /** A failure that may pass (network, 5xx, rate limit): the draft stays for the next sign-in or reload. */
  | { kind: "retry" };

let inFlight: Promise<GuestDraftOutcome> | null = null;

/** Post-auth step: saves a waiting guest draft once. Idempotent by the stored key, safe to run twice. */
export function applyGuestDayScenarioAfterAuth(storage: StorageLike | null = typeof window === "undefined" ? null : window.localStorage, fetchFn: typeof fetch = fetch, now: number = Date.now()): Promise<GuestDraftOutcome> {
  if (!storage) return Promise.resolve({ kind: "none" });
  if (inFlight) return inFlight;
  inFlight = (async (): Promise<GuestDraftOutcome> => {
    const raw = storage.getItem(GUEST_DAY_SCENARIO_DRAFT_KEY);
    const draft = parseGuestDayScenarioDraft(raw, now);
    if (!draft) {
      if (raw) storage.removeItem(GUEST_DAY_SCENARIO_DRAFT_KEY); // stale or foreign: never lingers
      return { kind: "none" };
    }
    let response: Response;
    try {
      response = await fetchFn("/api/plan/day-scenario/save", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", "Idempotency-Key": draft.idempotencyKey },
        body: JSON.stringify(draft.body),
      });
    } catch {
      return { kind: "retry" };
    }
    const forget = () => {
      // A newer draft written while the request ran is not ours to erase.
      if (storage.getItem(GUEST_DAY_SCENARIO_DRAFT_KEY) === raw) storage.removeItem(GUEST_DAY_SCENARIO_DRAFT_KEY);
    };
    if (response.ok) {
      forget();
      return { kind: "saved", dates: draft.body.days.map((day) => day.date) };
    }
    const json = (await response.json().catch(() => null)) as { code?: string } | null;
    const failure = saveFailureOf(response.status, json?.code);
    if (response.status === 429 || response.status >= 500 || failure === "sign_in") return { kind: "retry" };
    forget();
    return { kind: "rejected", failure, message: SAVE_FAILURE_TEXT[failure] };
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
