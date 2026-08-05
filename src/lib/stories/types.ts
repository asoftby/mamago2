export type SlotId = string;

/** Half-open instant range [start, end). */
export type DateRange = {
  start: Date;
  end: Date;
};

export type ResolveContext = {
  now: Date;
  timeZone: string;
  cityId: string;
  weather?: { tempC: number; condition: "hot" | "rain" | "normal" };
  hasBreakingNews: boolean;
  /**
   * When true, `lastchance` may enter resolve.
   * Wired in Phase 4 from Offer.promoUntil inventory; unset/false today (0 rows).
   */
  hasLastChanceOffers?: boolean;
};

export type StorySlot = {
  id: SlotId;
  kind: "temporal" | "contextual" | "editorial";
  label: (ctx: ResolveContext) => string;
  /** null — слот неприменим в этом контексте */
  range: (ctx: ResolveContext) => DateRange | null;
  priority: number;
  minItems: number;
  condition?: (ctx: ResolveContext) => boolean;
  /**
   * When false, this slot is never absorbed by another.
   * Default: true. Only relevant for `kind: "temporal"` (absorption is
   * temporal-only).
   */
  absorbable?: boolean;
  /** зарезервировано под нативное промо, пока всегда undefined */
  sponsoredBy?: string;
};

export type ResolvedSlot = {
  id: SlotId;
  kind: StorySlot["kind"];
  label: string;
  range: DateRange;
  priority: number;
  minItems: number;
};

/**
 * Applied by the rail UI, not by `resolveSlots`.
 * Branch (a) geometry: today + running (+ lastchance/breakingnews later) ≈ 2–3.
 * Confirm `minSlotsToRender` via replay — do not retune post-hoc to look pretty.
 */
export type RenderPolicy = {
  maxSlots: number;
  minSlotsToRender: number;
};

export const DEFAULT_RENDER_POLICY: RenderPolicy = {
  maxSlots: 6,
  /** Proposed for today+running; Phase 4 may add 1–2 more contextual. */
  minSlotsToRender: 2,
};

/** Default minItems for registry slots (today overrides to 1). */
export const DEFAULT_SLOT_MIN_ITEMS = 3;

/** today is the rail anchor — keep it visible with a single item. */
export const TODAY_SLOT_MIN_ITEMS = 1;
