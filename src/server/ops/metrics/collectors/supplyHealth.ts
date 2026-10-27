/**
 * supply.active_events / supply.active_places / supply.active_offers /
 * supply.content_freshness_pct — every 30 min.
 *
 * "Active" = what the public site actually shows right now — never an
 * all-time total (see dashboard plan §14: no vanity totals on the first
 * screen) and never a status-only count (ТЗ «Аналитика админки», C6). The
 * predicates are the SAME ones the public listings use
 * (`@/server/public/publicContentVisibility`), so an event of a switched-off
 * business, an archived place, or an offer of a hidden place no longer
 * inflates the numbers:
 *
 *   active_events  -> Activity WHERE type='EVENT' AND getPublicListingActivityWhere(now)
 *                     (public status + active owner business + not expired:
 *                     getActivityNotExpiredForPublicWhere)
 *   active_places  -> getPublicPublishedPlaceWhere(now)
 *                     (PUBLISHED + not archived + active owner business)
 *   active_offers  -> getPublicPublishedOfferWhere(now)
 *                     (PUBLISHED + not archived + publicly visible place)
 *
 * content_freshness_pct = (active inventory with updatedAt >= now - 7d) /
 * (all active inventory), across all three types combined. PROVISIONAL by
 * design (see Metric Dictionary): `updatedAt` is a technical modification
 * timestamp, not a guarantee the underlying event/place/offer information
 * is still accurate — a real "freshness" signal needs a content-specific
 * review/staleness field, tracked as a follow-up.
 */
import {
  getPublicListingActivityWhere,
  getPublicPublishedOfferWhere,
  getPublicPublishedPlaceWhere,
} from "@/server/public/publicContentVisibility";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

export async function collectSupplyHealth(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const { prisma, now } = ctx;
  const freshCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const activeEventWhere = { type: "EVENT" as const, AND: [getPublicListingActivityWhere(now)] };
  const activePlaceWhere = getPublicPublishedPlaceWhere(now);
  const activeOfferWhere = getPublicPublishedOfferWhere(now);

  const [activeEvents, activePlaces, activeOffers, freshEvents, freshPlaces, freshOffers] = await Promise.all([
    prisma.activity.count({ where: activeEventWhere }),
    prisma.place.count({ where: activePlaceWhere }),
    prisma.offer.count({ where: activeOfferWhere }),
    prisma.activity.count({ where: { ...activeEventWhere, updatedAt: { gte: freshCutoff } } }),
    prisma.place.count({ where: { ...activePlaceWhere, updatedAt: { gte: freshCutoff } } }),
    prisma.offer.count({ where: { ...activeOfferWhere, updatedAt: { gte: freshCutoff } } }),
  ]);

  const totalActive = activeEvents + activePlaces + activeOffers;
  const totalFresh = freshEvents + freshPlaces + freshOffers;

  const samples: MetricSampleDraft[] = [
    { metric: "supply.active_events", value: activeEvents },
    { metric: "supply.active_places", value: activePlaces },
    { metric: "supply.active_offers", value: activeOffers },
  ];
  if (totalActive > 0) {
    samples.push({ metric: "supply.content_freshness_pct", value: totalFresh / totalActive });
  }
  // totalActive === 0: freshness is undefined — no sample written.

  return samples;
}

export const supplyHealthCollector: MetricCollector = {
  name: "supply_health",
  intervalSec: 1_800,
  timeoutMs: 20_000,
  collect: collectSupplyHealth,
};
