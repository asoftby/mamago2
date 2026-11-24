import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { OffersList } from "./OffersList";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { getPerformanceMetricsByEntity } from "@/server/services/business/businessWorkspace.service";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getFreeBoostDialogState } from "@/server/services/promotion/dailyFreeBoost.service";

interface SearchParams {
  view?: "active" | "archived";
}

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  const business = await getMyBusiness(user.id);

  if (!business) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/onboarding",
        ...routing,
      }),
    );
  }

  const params = await searchParams;
  const view = params.view || "active";
  // Fetch offers for user's places (same ownership scope as getBusinessPlaces)
  const userPlaces = await prisma.place.findMany({
    where: {
      OR: [
        { createdByUserId: user.id },
        { ownerBusinessId: business.id },
      ],
    },
    select: { id: true },
  });

  const placeIds = userPlaces.map(p => p.id);

  const offers = placeIds.length > 0
    ? await prisma.offer.findMany({
        where: {
          placeId: { in: placeIds },
          ...(view === "archived"
            ? { archivedAt: { not: null } }
            : { archivedAt: null }),
        },
        select: {
          id: true,
          title: true,
          kind: true,
          status: true,
          archivedAt: true,
          rejectionReason: true,
          description: true,
          coverImage: true,
          priceFrom: true,
          priceText: true,
          campSessions: true,
          dateFrom: true,
          dateTo: true,
          updatedAt: true,
          createdAt: true,
          slug: true,
          campProgramType: true,
          placeId: true,
          place: {
            select: {
              id: true,
              title: true,
              archivedAt: true,
              city: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  // offers was filtered by placeId: { in: placeIds } above, so place can
  // never be null here — this narrows the type without a blind assertion.
  const placedOffers = offers.map((offer) => {
    if (!offer.place) {
      throw new Error(`Offer ${offer.id} matched the business's placeId filter but has no place`);
    }
    return { ...offer, placeId: offer.place.id, place: offer.place };
  });

  const [metricsByEntity, freeBoost] = await Promise.all([getPerformanceMetricsByEntity({
    events: [],
    offers: placedOffers.map((offer) => ({
      id: offer.id,
      title: offer.title,
      updatedAt: offer.createdAt,
      status: offer.status,
    })),
  }), getFreeBoostDialogState({ businessId: business.id, userId: user.id })]);
  const boostCandidates = new Map(
    freeBoost.candidates.filter((candidate) => candidate.publicationType === "OFFER").map((candidate) => [candidate.id, candidate]),
  );

  const offersWithMetrics = placedOffers.map((offer) => ({
    ...offer,
    boostDisabled: !freeBoost.availableToday || !boostCandidates.get(offer.id)?.eligible || Boolean(boostCandidates.get(offer.id)?.activeBoostUntil),
    boostNextFreeAt: boostCandidates.get(offer.id)?.activeFreeBoostUntil ?? null,
    // Both free and paid active Boost end times come from the persisted Boost record.
    isPromoted: Boolean(boostCandidates.get(offer.id)?.activeBoostUntil),
    boostEndsAt: boostCandidates.get(offer.id)?.activeBoostUntil ?? null,
    metrics: metricsByEntity.get(`OFFER:${offer.id}`) ?? {
      views: 0,
      saves: 0,
      planAdds: 0,
      ctaClicks: 0,
    },
  }));
  offersWithMetrics.sort((a, b) => Number(b.isPromoted) - Number(a.isPromoted));

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="ИНФРАСТРУКТУРА"
        title="Предложения"
        description="Предложения помогают быстро превращать интерес в обращение. Здесь важно видеть, какие предложения реально сохраняют и открывают."
      />

      <OffersList offers={offersWithMetrics} currentView={view} />
    </div>
  );
}
