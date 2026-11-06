export type PartyDraft = { id: string; version: number };
export type PartyReviewDraft = PartyDraft & {
  status: string;
  eventDate: string | null;
  childAge: number | null;
  childName: string | null;
  items: Array<{ role: string; offerId: string | null; category: string }>;
  estimate?: {
    exactByn: number;
    fromByn: number;
    unknownCount: number;
    lines: Array<{ offerId: string | null; mode: "EXACT" | "FROM" | "ON_REQUEST"; amount: number | null }>;
  };
};
export type PartySubmission = PartyDraft & { fingerprint: string };
export type PartyFlowState = {
  draft: PartyDraft | null;
  pending: PartySubmission | null;
  key: string | null;
  submitted: boolean;
  scope?: string;
  rememberDraft?: (id: string) => void;
};
export type PartySubmissionInput = {
  citySlug: string;
  venueMode: "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR";
  eventDate: string;
  timeFrom: string;
  timeTo: string;
  childrenCount: number;
  adultsCount: number;
  childName: string | null;
  /** Full years on the party date, so the server can check offer age limits. */
  childAge: number | null;
  contactName: string;
  contactPhone: string;
  anchorOfferId: string;
  addonOfferIds: string[];
  addonCategories?: string[];
};
export type PartyRequest = <T>(url: string, method: string, body?: object, key?: string) => Promise<T>;

export class PartyRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function partyRequest<T>(url: string, method: string, body?: object, key?: string): Promise<T> {
  const response = await fetch(url, {
    method, credentials: "same-origin",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(key ? { "Idempotency-Key": key } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new PartyRequestError(response.status, typeof data.error === "string" ? data.error : "Не удалось отправить заявку");
  return data as T;
}

/** The PartyOrder this flow created; one draft is reused across retries and edits. */
export function submittedPartyId(state: PartyFlowState): string | null {
  return state.pending?.id ?? state.draft?.id ?? null;
}

export async function saveBirthdayComposition(
  state: PartyFlowState,
  input: Pick<PartySubmissionInput, "citySlug" | "venueMode" | "anchorOfferId" | "addonOfferIds" | "addonCategories">,
  request: PartyRequest = partyRequest,
  recipient?: { eventDate: string; childName: string | null; childAge: number | null },
): Promise<PartyReviewDraft> {
  if (state.pending || state.submitted) throw new Error("Сначала уточните результат отправки заявки");
  const { citySlug, venueMode, ...selection } = input;
  if (!state.draft) {
    state.draft = await request<PartyDraft>("/api/parent/parties", "POST", { citySlug, venueMode });
    state.rememberDraft?.(state.draft.id);
  }
  const path = "/api/parent/parties/" + state.draft.id;
  const updated = await request<PartyReviewDraft>(path, "PATCH", {
    version: state.draft.version, venueMode, ...selection, ...recipient,
  });
  state.draft = updated;
  return updated;
}

export async function submitBirthdayParty(
  state: PartyFlowState, input: PartySubmissionInput, request: PartyRequest = partyRequest,
): Promise<void> {
  if (state.submitted) return;
  const fingerprint = JSON.stringify(input);
  const { citySlug, venueMode, ...updates } = input;

  // A failed HTTP response can mean the submit actually succeeded.
  // If the parent edited the form, check the order before rewriting the draft.
  if (state.pending && state.pending.fingerprint !== fingerprint) {
    const existing = await request<{ status: string }>("/api/parent/parties/" + state.pending.id, "GET");
    if (existing.status === "CANCELLED") throw new Error("Праздник отменён. Создайте новый заказ.");
    if (existing.status !== "DRAFT") { state.submitted = true; return; }
    state.pending = null;
    state.key = null;
  }

  try {
    if (!state.draft) {
      state.draft = await request<PartyDraft>("/api/parent/parties", "POST", { citySlug, venueMode });
      state.rememberDraft?.(state.draft.id);
    }
    const draft = state.draft;
    if (!state.pending) {
      const updated = await request<PartyDraft>("/api/parent/parties/" + draft.id, "PATCH",
        { version: draft.version, venueMode, ...updates });
      state.draft = { id: draft.id, version: updated.version };
      state.pending = { id: draft.id, version: updated.version, fingerprint };
      state.key = crypto.randomUUID().replace(/-/g, "");
    }
    await request("/api/parent/parties/" + state.pending.id + "/submit", "POST",
      { version: state.pending.version }, state.key!);
    state.submitted = true;
  } catch (cause) {
    if (state.pending && cause instanceof PartyRequestError && [409, 422].includes(cause.status)) {
      // A definitive rejection invalidates this submit attempt and its version.
      state.pending = null;
      state.key = null;
      if (cause.status === 422) throw cause;
    }
    // A PATCH may commit while its HTTP response is lost; reconcile CAS version.
    if (state.draft && !state.pending) {
      try {
        const existing = await request<{ status: string; version: number }>(
          "/api/parent/parties/" + state.draft.id, "GET");
        if (existing.status === "DRAFT") {
          state.draft = { id: state.draft.id, version: existing.version };
        } else if (existing.status !== "CANCELLED") {
          state.submitted = true;
          return;
        }
      } catch {
        // Preserve the original error; another attempt can reconcile.
      }
    }
    throw cause;
  }
}
