import { unstable_cache } from "next/cache";
import {
  breakdownForSlot,
  countsFromBreakdowns,
  type StoryRailCandidatePool,
} from "@/lib/stories/classify";
import {
  storyRailCountsCacheKey,
  storyRailSlotContentCacheKey,
  secondsUntilNextZonedMidnight,
} from "@/lib/stories/cacheKey";
import { getCityTimeZone } from "@/lib/stories/getCityTimeZone";
import type { OngoingTemporalPolicy } from "@/lib/stories/ongoingPolicy";
import { DEFAULT_ONGOING_TEMPORAL_POLICY } from "@/lib/stories/ongoingPolicy";
import { STORY_SLOTS } from "@/lib/stories/registry";
import { resolveSlots } from "@/lib/stories/resolveSlots";
import { seededShuffle, storySlotShuffleSeed } from "@/lib/stories/shuffle";
import { zonedDateKey } from "@/lib/stories/ranges";
import type { ResolveContext, ResolvedSlot, StorySlot } from "@/lib/stories/types";
import type { SlotItemBreakdown, StoryRailItem } from "@/lib/stories/items";
import {
  loadStoryRailCandidatePool,
  unionDateRanges,
} from "./loadStoryRailCandidatePool";

export type StoryRailSlotStats = {
  slot: ResolvedSlot;
  breakdown: SlotItemBreakdown;
};

export type StoryRailData = {
  dateKey: string;
  timeZone: string;
  ongoingPolicy: OngoingTemporalPolicy;
  /** True totals for minItems / badge internals. */
  counts: Record<string, number>;
  /** Slots after resolveSlots (before render policy). */
  resolved: ResolvedSlot[];
  stats: StoryRailSlotStats[];
  pool: StoryRailCandidatePool;
};

function candidateSlotsForCtx(ctx: ResolveContext, slots: StorySlot[]): ResolvedSlot[] {
  // Probe with generous counts so range/condition/absorption run fully;
  // real counts applied in a second resolveSlots pass by the caller.
  const probeCounts: Record<string, number> = {};
  for (const slot of slots) {
    probeCounts[slot.id] = Number.MAX_SAFE_INTEGER;
  }
  return resolveSlots(slots, ctx, probeCounts);
}

/**
 * Build rail data for a city: one DB batch → classify → counts.
 * Same pool + predicates feed {@link loadStorySlotContent}.
 */
export async function buildStoryRailData(input: {
  cityId: string;
  now?: Date;
  ongoingPolicy?: OngoingTemporalPolicy;
  slots?: StorySlot[];
  /** Skip Next.js cache (replay scripts). */
  bypassCache?: boolean;
}): Promise<StoryRailData> {
  const now = input.now ?? new Date();
  const ongoingPolicy = input.ongoingPolicy ?? DEFAULT_ONGOING_TEMPORAL_POLICY;
  const slots = input.slots ?? STORY_SLOTS;
  const timeZone = getCityTimeZone(input.cityId);
  const dateKey = zonedDateKey(now, timeZone);

  const run = async (): Promise<StoryRailData> => {
    const ctx: ResolveContext = {
      now,
      timeZone,
      cityId: input.cityId,
      hasBreakingNews: false,
    };

    const probed = candidateSlotsForCtx(ctx, slots);
    const union = unionDateRanges(probed.map((s) => s.range));
    const pool = union
      ? await loadStoryRailCandidatePool({
          cityId: input.cityId,
          unionRange: union,
          timeZone,
          now,
        })
      : {
          activitySessions: [],
          activityOrphans: [],
          offerSessions: [],
          ongoingOffers: [],
        };

    const stats: StoryRailSlotStats[] = probed.map((slot) => ({
      slot,
      breakdown: breakdownForSlot(pool, slot, ongoingPolicy),
    }));

    const breakdowns: Record<string, SlotItemBreakdown> = {};
    for (const s of stats) {
      breakdowns[s.slot.id] = s.breakdown;
    }
    const counts = countsFromBreakdowns(breakdowns);
    const resolved = resolveSlots(slots, ctx, counts);

    return {
      dateKey,
      timeZone,
      ongoingPolicy,
      counts,
      resolved,
      /** Breakdown for every probe candidate (incl. below minItems) — for metrics/replay. */
      stats,
      pool,
    };
  };

  if (input.bypassCache) {
    return run();
  }

  const cacheKey = storyRailCountsCacheKey({
    cityId: input.cityId,
    dateKey,
    ongoingPolicy,
  });
  const revalidate = secondsUntilNextZonedMidnight(now, timeZone);

  return unstable_cache(run, [cacheKey], { revalidate })();
}

/**
 * Content for one slot — same classification as counts, then seeded shuffle.
 */
export async function loadStorySlotContent(input: {
  cityId: string;
  slotId: string;
  now?: Date;
  ongoingPolicy?: OngoingTemporalPolicy;
  slots?: StorySlot[];
  bypassCache?: boolean;
  limit?: number;
}): Promise<StoryRailItem[]> {
  const now = input.now ?? new Date();
  const ongoingPolicy = input.ongoingPolicy ?? DEFAULT_ONGOING_TEMPORAL_POLICY;
  const slots = input.slots ?? STORY_SLOTS;
  const timeZone = getCityTimeZone(input.cityId);
  const dateKey = zonedDateKey(now, timeZone);
  const limit = input.limit ?? 40;

  const run = async (): Promise<StoryRailItem[]> => {
    const data = await buildStoryRailData({
      cityId: input.cityId,
      now,
      ongoingPolicy,
      slots,
      bypassCache: true,
    });
    const stat = data.stats.find((s) => s.slot.id === input.slotId);
    if (!stat) return [];
    const shuffled = seededShuffle(
      stat.breakdown.items,
      storySlotShuffleSeed(input.slotId, dateKey),
    );
    return shuffled.slice(0, limit);
  };

  if (input.bypassCache) {
    return run();
  }

  const cacheKey = storyRailSlotContentCacheKey({
    cityId: input.cityId,
    slotId: input.slotId,
    dateKey,
    ongoingPolicy,
  });
  const revalidate = secondsUntilNextZonedMidnight(now, timeZone);
  return unstable_cache(run, [cacheKey], { revalidate })();
}
