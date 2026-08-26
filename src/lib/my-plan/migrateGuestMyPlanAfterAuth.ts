"use client";

import {
  GUEST_MY_PLAN_DRAFT_STORAGE_KEY,
  type GuestMyPlanDraftV1,
  type SerializedGuestCommittedItem,
} from "./guestMyPlanDraftStorage";
import { MY_PLAN_REFETCH_DATE_EVENT } from "./myPlanOpenIntent";
import { persistSelectedPlanDate } from "@/features/my-plan/lib/planRecommendationDraftStorage";

const GUEST_SLOTS = ["morning", "afternoon", "evening"] as const;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type GuestPlanMigrationResult = {
  migratedCount: number;
  selectedDate: string | null;
};

function readGuestDraftFromRaw(raw: string | null): GuestMyPlanDraftV1 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GuestMyPlanDraftV1;
    if (!parsed || parsed.v !== 1) return null;
    if (typeof parsed.anonymousId !== "string" || !parsed.anonymousId.trim()) return null;
    if (typeof parsed.citySlug !== "string" || !parsed.citySlug.trim()) return null;
    if (!parsed.committedBySlot || typeof parsed.committedBySlot !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function committedItems(draft: GuestMyPlanDraftV1): SerializedGuestCommittedItem[] {
  const items: SerializedGuestCommittedItem[] = [];
  for (const slot of GUEST_SLOTS) {
    const item = draft.committedBySlot[slot];
    if (!item || typeof item.activityId !== "string" || !item.activityId.trim()) continue;
    items.push(item);
  }
  return items;
}

function resolvePlanDate(
  draft: GuestMyPlanDraftV1,
  item: SerializedGuestCommittedItem,
): string | null {
  if (typeof item.date === "string" && ISO_DATE_RE.test(item.date)) return item.date;
  if (
    typeof draft.selectedPlanDateIso === "string" &&
    ISO_DATE_RE.test(draft.selectedPlanDateIso)
  ) {
    return draft.selectedPlanDateIso;
  }
  return null;
}

/**
 * Materializes only the cards the guest explicitly added with "В план".
 * The server endpoint is idempotent by userId + activityId, so retrying after a
 * partial failure cannot create duplicate plan rows.
 */
export async function syncGuestMyPlanDraft(
  draft: GuestMyPlanDraftV1,
  fetchFn: typeof fetch = fetch,
): Promise<GuestPlanMigrationResult> {
  const items = committedItems(draft);
  if (items.length === 0) {
    return {
      migratedCount: 0,
      selectedDate:
        typeof draft.selectedPlanDateIso === "string" &&
        ISO_DATE_RE.test(draft.selectedPlanDateIso)
          ? draft.selectedPlanDateIso
          : null,
    };
  }

  let selectedDate: string | null = null;
  for (const item of items) {
    const date = resolvePlanDate(draft, item);
    if (!date) throw new Error("guest_plan_invalid_date");
    selectedDate ??= date;

    const res = await fetchFn("/api/save/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        activityId: item.activityId,
        date,
        startsAt: item.startsAt ?? undefined,
        title: item.title ?? item.activity?.title ?? undefined,
        coverImageUrl:
          item.coverImageUrl ?? item.activity?.coverImageUrl ?? undefined,
        planAddSource: "recommendation",
      }),
    });

    if (!res.ok) throw new Error("guest_plan_save_failed");
  }

  return { migratedCount: items.length, selectedDate };
}

let migrationInFlight: Promise<GuestPlanMigrationResult> | null = null;

/**
 * Post-auth bridge for the guest "Подбери за меня" flow.
 * Keeps the draft on any error and clears it only after every committed item is
 * confirmed by /api/save/plan.
 */
export function migrateGuestMyPlanAfterAuth(): Promise<GuestPlanMigrationResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ migratedCount: 0, selectedDate: null });
  }
  if (migrationInFlight) return migrationInFlight;

  migrationInFlight = (async () => {
    const raw = window.localStorage.getItem(GUEST_MY_PLAN_DRAFT_STORAGE_KEY);
    const draft = readGuestDraftFromRaw(raw);
    if (!draft) return { migratedCount: 0, selectedDate: null };

    const result = await syncGuestMyPlanDraft(draft);
    if (result.migratedCount === 0) return result;

    if (result.selectedDate) {
      persistSelectedPlanDate(result.selectedDate);
    }

    // Do not erase a newer draft that may have been written while requests ran.
    if (window.localStorage.getItem(GUEST_MY_PLAN_DRAFT_STORAGE_KEY) === raw) {
      window.localStorage.removeItem(GUEST_MY_PLAN_DRAFT_STORAGE_KEY);
    }

    if (result.selectedDate) {
      window.dispatchEvent(
        new CustomEvent(MY_PLAN_REFETCH_DATE_EVENT, {
          detail: { date: result.selectedDate },
        }),
      );
    }

    return result;
  })().finally(() => {
    migrationInFlight = null;
  });

  return migrationInFlight;
}
