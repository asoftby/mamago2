import type { MyPlanGuestPanelPhase } from "@/features/my-plan/components/guestMyPlanTypes";
import type { MyPlanIdea } from "@/features/my-plan/hooks/useMyPlan";
import type { PlanItemWithActivity } from "@/features/my-plan/types/event";

export const GUEST_MY_PLAN_DRAFT_STORAGE_KEY = "mamago:guestMyPlanDraft:v1";

export type GuestPlanSlot = "morning" | "afternoon" | "evening";

export type SerializedGuestCommittedItem = Omit<
  PlanItemWithActivity,
  "startsAt" | "createdAt"
> & {
  startsAt: string | null;
  createdAt: string;
};

export type GuestMyPlanDraftV1 = {
  v: 1;
  anonymousId: string;
  citySlug: string;
  phase: MyPlanGuestPanelPhase;
  authGateVisible: boolean;
  engagementActionCount: number;
  freeSearch: boolean;
  goAdult: boolean;
  kidRanges: string[];
  whenChoice: "today" | "tomorrow" | "weekend";
  formatChoice: "calm" | "active" | "any";
  scenarioSlots: Array<{
    slot: GuestPlanSlot;
    activity: NonNullable<MyPlanIdea["activity"]>;
  }>;
  committedBySlot: Partial<
    Record<GuestPlanSlot, SerializedGuestCommittedItem>
  >;
  guestRemainingGenerations: number | null;
  guestQuotaBlocked: boolean;
  /** Дата плана в контексте подборки (ISO yyyy-mm-dd) */
  selectedPlanDateIso: string | null;
};

function isGuestPlanSlot(x: string): x is GuestPlanSlot {
  return x === "morning" || x === "afternoon" || x === "evening";
}

function isPhase(x: string): x is MyPlanGuestPanelPhase {
  return (
    x === "empty" ||
    x === "onboarding" ||
    x === "generated" ||
    x === "engaged"
  );
}

function revivePlanItem(raw: SerializedGuestCommittedItem): PlanItemWithActivity {
  return {
    ...raw,
    startsAt: raw.startsAt ? new Date(raw.startsAt) : null,
    createdAt: new Date(raw.createdAt),
  } as PlanItemWithActivity;
}

function serializeCommitted(
  committed: Partial<Record<GuestPlanSlot, PlanItemWithActivity>>,
): GuestMyPlanDraftV1["committedBySlot"] {
  const out: GuestMyPlanDraftV1["committedBySlot"] = {};
  for (const slot of ["morning", "afternoon", "evening"] as const) {
    const it = committed[slot];
    if (!it) continue;
    out[slot] = {
      ...it,
      startsAt: it.startsAt?.toISOString() ?? null,
      createdAt: it.createdAt.toISOString(),
    };
  }
  return out;
}

export function loadGuestMyPlanDraft(
  anonymousId: string,
  citySlug: string,
): GuestMyPlanDraftV1 | null {
  if (typeof window === "undefined" || !anonymousId.trim()) return null;
  try {
    const raw = window.localStorage.getItem(GUEST_MY_PLAN_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestMyPlanDraftV1;
    if (parsed?.v !== 1) return null;
    if (parsed.anonymousId !== anonymousId) return null;
    if (parsed.citySlug !== citySlug) return null;
    if (!isPhase(parsed.phase)) return null;

    const slots = Array.isArray(parsed.scenarioSlots)
      ? parsed.scenarioSlots.filter(
          (row) =>
            row &&
            isGuestPlanSlot(row.slot) &&
            row.activity &&
            typeof row.activity.id === "string",
        )
      : [];
    parsed.scenarioSlots = slots;

    const committedIn = parsed.committedBySlot;
    const committedOut: GuestMyPlanDraftV1["committedBySlot"] = {};
    if (committedIn && typeof committedIn === "object") {
      for (const slot of ["morning", "afternoon", "evening"] as const) {
        const row = committedIn[slot];
        if (
          row &&
          typeof row === "object" &&
          typeof row.createdAt === "string"
        ) {
          committedOut[slot] = row;
        }
      }
    }
    parsed.committedBySlot = committedOut;

    return parsed;
  } catch {
    return null;
  }
}

export function persistGuestMyPlanDraft(draft: GuestMyPlanDraftV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GUEST_MY_PLAN_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    );
  } catch {
    /* quota / private mode */
  }
}

export function buildGuestMyPlanDraftPayload(params: {
  anonymousId: string;
  citySlug: string;
  phase: MyPlanGuestPanelPhase;
  authGateVisible: boolean;
  engagementActionCount: number;
  freeSearch: boolean;
  goAdult: boolean;
  kidRanges: string[];
  whenChoice: "today" | "tomorrow" | "weekend";
  formatChoice: "calm" | "active" | "any";
  scenarioSlots: Array<{
    slot: GuestPlanSlot;
    activity: NonNullable<MyPlanIdea["activity"]>;
  }>;
  committedBySlot: Partial<Record<GuestPlanSlot, PlanItemWithActivity>>;
  guestRemainingGenerations: number | null;
  guestQuotaBlocked: boolean;
  selectedPlanDateIso: string | null;
}): GuestMyPlanDraftV1 {
  return {
    v: 1,
    anonymousId: params.anonymousId,
    citySlug: params.citySlug,
    phase: params.phase,
    authGateVisible: params.authGateVisible,
    engagementActionCount: params.engagementActionCount,
    freeSearch: params.freeSearch,
    goAdult: params.goAdult,
    kidRanges: [...params.kidRanges],
    whenChoice: params.whenChoice,
    formatChoice: params.formatChoice,
    scenarioSlots: params.scenarioSlots.map((r) => ({
      slot: r.slot,
      activity: r.activity,
    })),
    committedBySlot: serializeCommitted(params.committedBySlot),
    guestRemainingGenerations: params.guestRemainingGenerations,
    guestQuotaBlocked: params.guestQuotaBlocked,
    selectedPlanDateIso: params.selectedPlanDateIso,
  };
}

export function reviveCommittedFromDraft(
  draft: GuestMyPlanDraftV1,
): Partial<Record<GuestPlanSlot, PlanItemWithActivity>> {
  const out: Partial<Record<GuestPlanSlot, PlanItemWithActivity>> = {};
  for (const slot of ["morning", "afternoon", "evening"] as const) {
    const raw = draft.committedBySlot[slot];
    if (raw) out[slot] = revivePlanItem(raw);
  }
  return out;
}
