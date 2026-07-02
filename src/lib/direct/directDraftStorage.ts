"use client";

/**
 * Resume-after-login for the Direct request form.
 *
 * Direct requires an authenticated customerUserId (no anonymous threads,
 * unlike BookingRequest). Per CLAUDE.md, the auth system's `intent` param
 * is explicitly not implemented yet — so instead of extending that system,
 * this stores the in-progress form client-side and the publication page
 * checks for it on mount after the user returns from /login.
 *
 * Deliberately NOT auto-submitted on return: the user lands back on the
 * form pre-filled and clicks "Отправить заявку" again themselves.
 */

export interface DirectRequestDraft {
  publicationType: "OFFER" | "EVENT" | "PLACE";
  offerId?: string;
  activityId?: string;
  placeId?: string;
  comment: string;
  date?: string;
  childAge?: string;
  guestsCount?: string;
}

function draftKey(ref: Pick<DirectRequestDraft, "publicationType" | "offerId" | "activityId" | "placeId">): string {
  const id = ref.offerId ?? ref.activityId ?? ref.placeId ?? "unknown";
  return `direct:draft:${ref.publicationType}:${id}`;
}

export function saveDirectRequestDraft(draft: DirectRequestDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(draftKey(draft), JSON.stringify(draft));
  } catch {
    // sessionStorage unavailable (private mode, quota) — draft just won't resume, non-fatal.
  }
}

export function readAndClearDirectRequestDraft(
  ref: Pick<DirectRequestDraft, "publicationType" | "offerId" | "activityId" | "placeId">,
): DirectRequestDraft | null {
  if (typeof window === "undefined") return null;
  const key = draftKey(ref);
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    window.sessionStorage.removeItem(key);
    return JSON.parse(raw) as DirectRequestDraft;
  } catch {
    return null;
  }
}
