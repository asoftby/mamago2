import { todayRange, runningHorizonRange } from "./ranges";
import { SERIAL_CLASSIFICATION_CONFIG } from "./serialConfig";
import { DEFAULT_SLOT_MIN_ITEMS, TODAY_SLOT_MIN_ITEMS, type StorySlot } from "./types";

/**
 * Declarative story-rail slot registry — branch (a).
 *
 * Temporal axis collapsed to a single honest `today` (point events).
 * Serial programs live in contextual `running`. Facet slots for Phase 4
 * (`lastchance`, `free`, `breakingnews`) join here; `newplaces` is deferred.
 *
 * Removed: `tomorrow` / `weekend` / `nextweek` — on current inventory they
 * cannot reach minItems without lying about dates.
 */
export const STORY_SLOTS: StorySlot[] = [
  {
    id: "today",
    kind: "temporal",
    label: () => "Сегодня",
    range: todayRange,
    priority: 10,
    minItems: TODAY_SLOT_MIN_ITEMS,
    absorbable: false,
  },
  {
    id: "running",
    kind: "contextual",
    label: () => "Идёт сейчас",
    range: (ctx) =>
      runningHorizonRange(ctx, SERIAL_CLASSIFICATION_CONFIG.runningHorizonDays),
    priority: 35,
    minItems: 1,
  },
  {
    id: "free",
    kind: "contextual",
    label: () => "Бесплатно",
    range: (ctx) => runningHorizonRange(ctx, 7),
    priority: 40,
    minItems: 1,
  },
  {
    id: "lastchance",
    kind: "contextual",
    label: () => "Успеть",
    // Range unused while condition is false; Phase 4 wires promoUntil load.
    range: (ctx) =>
      runningHorizonRange(ctx, SERIAL_CLASSIFICATION_CONFIG.runningHorizonDays),
    priority: 45,
    minItems: DEFAULT_SLOT_MIN_ITEMS,
    /**
     * Honest empty: Minsk Offer.promoUntil = 0. Do not invent a surrogate.
     * Flip via ResolveContext.hasLastChanceOffers when inventory exists.
     */
    condition: (ctx) => ctx.hasLastChanceOffers === true,
  },
];

/**
 * NOT in {@link STORY_SLOTS} — return condition for `newplaces`:
 *
 * Place.createdAt on the current dump clusters around a single import/deploy
 * (72/77 within 14d). Any freshness threshold either floods the rail with the
 * whole catalog or yields nothing — the signal does not discriminate.
 *
 * Revisit when a remount of `createdAt` (or a real «became public» field)
 * stops clustering around mamaGo 2.0 launch. Check empirically; do not guess
 * from the calendar alone.
 */
export const DEFERRED_STORY_SLOT_IDS = ["newplaces"] as const;

export function getStorySlot(id: string): StorySlot | undefined {
  return STORY_SLOTS.find((slot) => slot.id === id);
}
