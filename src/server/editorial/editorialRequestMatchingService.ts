import type { Prisma } from "@prisma/client";
import { SignalStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { normalizeEditorialRequestCriteria } from "@/lib/editorial/schemas";
import { listDiscoveryClassChips } from "@/server/discovery/classChips";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";

type MatchSignal = {
  id: string;
  title: string;
  slug: string;
};

export type EditorialBusinessMatch = {
  businessId: string;
  businessName: string;
  businessPhone: string | null;
  ownerEmail: string | null;
  cityName: string | null;
  places: Array<{
    id: string;
    title: string;
  }>;
  matchedOffers: Array<{
    id: string;
    title: string;
    status: string;
    cityName: string | null;
    placeTitle: string;
    matchedDiscoverySignals: MatchSignal[];
    matchedClassChips: Array<{
      slug: string;
      title: string;
    }>;
  }>;
  matchedOfferCount: number;
  matchReason: string;
};

export type EditorialRequestMatchesResult = {
  criteriaSelected: boolean;
  cityScopeLabel: string;
  businesses: EditorialBusinessMatch[];
};

function buildMatchReason(
  matchedOffers: EditorialBusinessMatch["matchedOffers"],
): string {
  const lines = matchedOffers.map((offer) => {
    const reasonParts: string[] = [];

    if (offer.matchedDiscoverySignals.length > 0) {
      reasonParts.push(
        `signals: ${offer.matchedDiscoverySignals.map((signal) => signal.slug).join(", ")}`,
      );
    }

    if (offer.matchedClassChips.length > 0) {
      reasonParts.push(
        `class chips: ${offer.matchedClassChips.map((chip) => chip.slug).join(", ")}`,
      );
    }

    const suffix = reasonParts.length > 0 ? ` - ${reasonParts.join("; ")}` : "";
    return `- "${offer.title}"${suffix}`;
  });

  return `Matched by ${matchedOffers.length} published offer${
    matchedOffers.length === 1 ? "" : "s"
  }:\n${lines.join("\n")}`;
}

export async function previewEditorialRequestMatchesByRequestId(
  requestId: string,
): Promise<EditorialRequestMatchesResult | null> {
  const request = await prisma.editorialRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      cityId: true,
      city: {
        select: {
          name: true,
        },
      },
      criteria: true,
    },
  });

  if (!request) {
    return null;
  }

  return previewEditorialRequestMatches({
    cityId: request.cityId,
    cityName: request.city?.name ?? null,
    criteria: request.criteria,
  });
}

export async function previewEditorialRequestMatches(params: {
  cityId?: string | null;
  cityName?: string | null;
  criteria: unknown;
}): Promise<EditorialRequestMatchesResult> {
  const criteria = normalizeEditorialRequestCriteria(params.criteria);
  const selectedSignalIds = Array.from(new Set(criteria.discoverySignalIds));
  const selectedClassChipSlugs = Array.from(new Set(criteria.classChipSlugs));
  const hasCriteria =
    selectedSignalIds.length > 0 || selectedClassChipSlugs.length > 0;

  const cityScopeLabel = params.cityName
    ? `City scope: ${params.cityName}`
    : "Global scope: all cities";

  if (!hasCriteria) {
    return {
      criteriaSelected: false,
      cityScopeLabel,
      businesses: [],
    };
  }

  const publicOfferWhere = getPublicPublishedOfferWhere();
  const publicOfferWhereParts = (publicOfferWhere.AND ?? []) as Prisma.OfferWhereInput[];
  const matchOrParts: Prisma.OfferWhereInput[] = [];

  if (selectedSignalIds.length > 0) {
    matchOrParts.push({
      discoverySignalIds: {
        hasSome: selectedSignalIds,
      },
    });
  }

  if (selectedClassChipSlugs.length > 0) {
    matchOrParts.push({
      classChipSlugs: {
        hasSome: selectedClassChipSlugs,
      },
    });
  }

  const [offers, selectedSignals, selectedChips] = await Promise.all([
    prisma.offer.findMany({
      where: {
        AND: [
          ...publicOfferWhereParts,
          {
            place: {
              ownerBusinessId: {
                not: null,
              },
            },
          },
          ...(params.cityId
            ? [
                {
                  OR: [
                    { cityId: params.cityId },
                    { place: { cityId: params.cityId } },
                  ],
                } satisfies Prisma.OfferWhereInput,
              ]
            : []),
          {
            OR: matchOrParts,
          },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        discoverySignalIds: true,
        classChipSlugs: true,
        place: {
          select: {
            id: true,
            title: true,
            city: {
              select: {
                name: true,
              },
            },
            ownerBusiness: {
              select: {
                id: true,
                name: true,
                phone: true,
                owner: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ place: { title: "asc" } }, { title: "asc" }],
    }),
    selectedSignalIds.length > 0
      ? prisma.signalDefinition.findMany({
          where: {
            id: { in: selectedSignalIds },
            isActive: true,
          },
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    listDiscoveryClassChips({ includeInactive: true }),
  ]);

  const signalById = new Map(
    selectedSignals
      .filter((signal) => signal.status === SignalStatus.ACTIVE)
      .map((signal) => [
        signal.id,
        {
          id: signal.id,
          title: signal.title,
          slug: signal.slug,
        },
      ]),
  );
  const classChipBySlug = new Map(
    selectedChips.map((chip) => [chip.slug, { slug: chip.slug, title: chip.title }]),
  );

  const grouped = new Map<string, EditorialBusinessMatch>();

  for (const offer of offers) {
    const place = offer.place;
    const business = place?.ownerBusiness;
    if (!place || !business) continue;

    const matchedDiscoverySignals = offer.discoverySignalIds
      .filter((id) => selectedSignalIds.includes(id))
      .map((id) => signalById.get(id))
      .filter((value): value is MatchSignal => Boolean(value));

    const matchedClassChips = offer.classChipSlugs
      .filter((slug) => selectedClassChipSlugs.includes(slug))
      .map((slug) => classChipBySlug.get(slug))
      .filter(
        (
          value,
        ): value is {
          slug: string;
          title: string;
        } => Boolean(value),
      );

    if (
      matchedDiscoverySignals.length === 0 &&
      matchedClassChips.length === 0
    ) {
      continue;
    }

    const current =
      grouped.get(business.id) ??
      ({
        businessId: business.id,
        businessName: business.name,
        businessPhone: business.phone,
        ownerEmail: business.owner.email,
        cityName: place.city?.name ?? null,
        places: [],
        matchedOffers: [],
        matchedOfferCount: 0,
        matchReason: "",
      } satisfies EditorialBusinessMatch);

    if (!current.places.some((place) => place.id === place.id)) {
      current.places.push({
        id: place.id,
        title: place.title,
      });
    }

    current.matchedOffers.push({
      id: offer.id,
      title: offer.title,
      status: offer.status,
      cityName: place.city?.name ?? null,
      placeTitle: place.title,
      matchedDiscoverySignals,
      matchedClassChips,
    });

    current.matchedOfferCount = current.matchedOffers.length;
    grouped.set(business.id, current);
  }

  const businesses = Array.from(grouped.values())
    .map((business) => ({
      ...business,
      places: business.places.sort((left, right) =>
        left.title.localeCompare(right.title),
      ),
      matchedOffers: business.matchedOffers.sort((left, right) =>
        left.title.localeCompare(right.title),
      ),
    }))
    .map((business) => ({
      ...business,
      matchReason: buildMatchReason(business.matchedOffers),
    }))
    .sort((left, right) => left.businessName.localeCompare(right.businessName));

  return {
    criteriaSelected: true,
    cityScopeLabel,
    businesses,
  };
}
