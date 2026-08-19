import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Prisma, type PlaceRevisionStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canEditPlace } from "@/lib/permissions/placeEditPermissions";
import { MarketplacePlacePage } from "@/components/place/marketplace";
import { ContentPreviewBanner } from "@/components/shared/ContentPreviewBanner";
import { editorPlaceEditHref } from "@/lib/content-editor/types";
import { getPlaceDisplayTitle } from "@/lib/placeDisplayTitle";
import { formatMarketplaceHeroAddress } from "@/lib/placeLocationString";
import { resolveInstagramProfileHref } from "@/lib/instagram/extractUsername";
import { buildPublicWorkingHoursText } from "@/server/services/openingHours/openingHours.publicSummary";
import { getOpeningStatus } from "@/server/services/openingHours/openingHours.service";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";
import { resolvePlaceLogoImage } from "@/lib/place/resolvePlaceLogoImage";
import { resolvePlaceLogoUrlFromDb } from "@/lib/place/resolvePlaceLogoUrlFromDb";
import { mapPlacePageMedia } from "@/lib/media/mapPlacePageMedia";
import { fetchReelsThumbnail } from "@/lib/instagram/fetchReelsThumbnail";
import { parsePriceData } from "@/lib/priceItems";
import { getNormalizedPlacePhones } from "@/lib/place/placePhones";
import {
  isGoogleReviewsEnabled,
  readGoogleReviewsPayload,
} from "@/lib/place/googleReviewsMeta";
import {
  loadUpcomingPlaceEvents,
  mapUpcomingPlaceEventsToActivityMocks,
} from "@/lib/place/loadUpcomingPlaceEvents";
import { normalizeFaqItems } from "@/lib/faq/faqItems";
import { isPlacePubliclyVisible } from "@/lib/plan/publicVisibility";
import type { StoredGoogleReview } from "@/types/google-places";

type PageProps = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: "Предпросмотр места",
  robots: { index: false, follow: false },
};

const previewBannerHint =
  "Это предпросмотр изменений. Некоторые связанные блоки могут отображаться из опубликованной версии.";

const activeRevisionStatuses: PlaceRevisionStatus[] = [
  "DRAFT",
  "PENDING",
  "NEEDS_REVISION",
];

const placePreviewInclude = Prisma.validator<Prisma.PlaceInclude>()({
  images: {
    orderBy: { sortOrder: "asc" as const },
  },
  city: {
    select: {
      name: true,
      slug: true,
    },
  },
  districtAuto: {
    select: {
      name: true,
    },
  },
  districtManual: {
    select: {
      name: true,
    },
  },
  metroAuto: {
    select: {
      name: true,
    },
  },
  metroManual: {
    select: {
      name: true,
    },
  },
  openingHours: {
    include: {
      rules: {
        include: {
          intervals: { orderBy: { sortOrder: "asc" as const } },
        },
      },
      exceptions: {
        include: {
          intervals: { orderBy: { sortOrder: "asc" as const } },
        },
      },
    },
  },
  primaryCategory: {
    select: {
      nameRu: true,
    },
  },
  revisions: {
    where: {
      status: {
        in: activeRevisionStatuses,
      },
    },
    orderBy: {
      createdAt: "desc" as const,
    },
    take: 1,
    include: {
      city: {
        select: {
          name: true,
          slug: true,
        },
      },
      openingHours: {
        include: {
          rules: {
            include: {
              intervals: { orderBy: { sortOrder: "asc" as const } },
            },
          },
          exceptions: {
            include: {
              intervals: { orderBy: { sortOrder: "asc" as const } },
            },
          },
        },
      },
      images: {
        orderBy: { sortOrder: "asc" as const },
      },
    },
  },
});

type PlacePreviewRecord = Prisma.PlaceGetPayload<{
  include: typeof placePreviewInclude;
}>;

type PlacePreviewRevision = PlacePreviewRecord["revisions"][number];

function getPreviewLabel(place: PlacePreviewRecord, activeRevision: PlacePreviewRevision | null): string {
  if (activeRevision?.status === "PENDING") return "Изменения места отправлены на модерацию";
  if (activeRevision?.status === "DRAFT") return "Черновик изменений места";
  if (activeRevision?.status === "NEEDS_REVISION") return "Изменения места требуют доработки";
  if (place.status === "PENDING") return "Место отправлено на модерацию";
  if (place.status === "DRAFT") return "Черновик места";
  if (place.status === "NEEDS_REVISION") return "Место требует доработки";
  return "Предпросмотр места";
}

async function resolveDistrict(
  targetId: string | null,
  currentId: string | null,
  currentValue: { name: string } | null,
) {
  if (!targetId) return null;
  if (targetId === currentId) return currentValue;
  return prisma.district.findUnique({
    where: { id: targetId },
    select: { name: true },
  });
}

async function resolveMetro(
  targetId: string | null,
  currentId: string | null,
  currentValue: { name: string } | null,
) {
  if (!targetId) return null;
  if (targetId === currentId) return currentValue;
  return prisma.metroStation.findUnique({
    where: { id: targetId },
    select: { name: true },
  });
}

export default async function MePlacePreviewPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const place = await prisma.place.findUnique({
    where: { id },
    include: placePreviewInclude,
  });

  if (
    !place ||
    !(await canEditPlace(user, {
      placeId: place.id,
      createdByUserId: place.createdByUserId,
      ownerBusinessId: place.ownerBusinessId,
      status: place.status,
    }))
  ) {
    notFound();
  }

  const activeRevision = place.status === "PUBLISHED" ? place.revisions[0] ?? null : null;
  const previewLabel = getPreviewLabel(place, activeRevision);

  const previewCity = activeRevision ? activeRevision.city ?? null : place.city;
  const previewCityId = activeRevision ? activeRevision.cityId : place.cityId;
  const previewDistrictAutoId = activeRevision ? activeRevision.districtAutoId : place.districtAutoId;
  const previewDistrictManualId = activeRevision ? activeRevision.districtManualId : place.districtManualId;
  const previewMetroAutoId = activeRevision ? activeRevision.metroAutoId : place.metroAutoId;
  const previewMetroManualId = activeRevision ? activeRevision.metroManualId : place.metroManualId;

  const [districtAuto, districtManual, metroAuto, metroManual] = await Promise.all([
    resolveDistrict(previewDistrictAutoId, place.districtAutoId, place.districtAuto),
    resolveDistrict(previewDistrictManualId, place.districtManualId, place.districtManual),
    resolveMetro(previewMetroAutoId, place.metroAutoId, place.metroAuto),
    resolveMetro(previewMetroManualId, place.metroManualId, place.metroManual),
  ]);

  const previewGooglePlaceId = activeRevision
    ? activeRevision.googlePlaceId
    : place.googlePlaceId;
  const canReuseStoredGoogleData = previewGooglePlaceId === place.googlePlaceId;
  const displayTitle = await getPlaceDisplayTitle(prisma, {
    id: place.id,
    title: activeRevision ? activeRevision.title ?? place.title : place.title,
    formattedAddr: activeRevision ? activeRevision.formattedAddr : place.formattedAddr,
    customAddress: activeRevision ? activeRevision.customAddress : place.customAddress,
    shortAddress: place.shortAddress,
    cityId: previewCityId,
  });

  const previewImages = activeRevision ? activeRevision.images : place.images;
  const previewLogoImageId = activeRevision ? activeRevision.logoImageId : place.logoImageId;
  const previewReelsUrl = activeRevision ? activeRevision.reelsUrl : place.reelsUrl;
  const previewOpeningHours = (
    activeRevision ? activeRevision.openingHours : place.openingHours
  ) as OpeningHoursWithRelations | null;
  const previewPlaceGroupId = activeRevision ? activeRevision.placeGroupId : place.placeGroupId;
  const previewShortDesc = activeRevision ? activeRevision.shortDesc ?? place.shortDesc : place.shortDesc;
  const previewDescription = activeRevision ? activeRevision.description : place.description;
  const previewFormattedAddr = activeRevision ? activeRevision.formattedAddr : place.formattedAddr;
  const previewCustomAddress = activeRevision ? activeRevision.customAddress : place.customAddress;
  const previewLat = activeRevision ? activeRevision.lat : place.lat;
  const previewLng = activeRevision ? activeRevision.lng : place.lng;
  const previewPhone = activeRevision ? activeRevision.phone : place.phone;
  const previewPhoneLabel = activeRevision ? activeRevision.phoneLabel : place.phoneLabel;
  const previewPhone2 = activeRevision ? activeRevision.phone2 : place.phone2;
  const previewPhone2Label = activeRevision ? activeRevision.phone2Label : place.phone2Label;
  const previewPhone3 = activeRevision ? activeRevision.phone3 : place.phone3;
  const previewPhone3Label = activeRevision ? activeRevision.phone3Label : place.phone3Label;
  const previewWebsite = activeRevision ? activeRevision.website : place.website;
  const previewInstagramHandle = activeRevision ? activeRevision.instagramHandle : place.instagramHandle;
  const previewInstagramUrl = activeRevision ? activeRevision.instagramUrl : place.instagramUrl;
  const previewFaqItems = activeRevision ? activeRevision.faqItems : place.faqItems;

  const relatedPlacesRaw = previewPlaceGroupId
    ? await prisma.place.findMany({
        where: {
          placeGroupId: previewPlaceGroupId,
          id: { not: place.id },
          status: "PUBLISHED",
          archivedAt: null,
        },
        select: {
          id: true,
          slug: true,
          title: true,
          category: true,
          logoImageId: true,
          shortAddress: true,
          formattedAddr: true,
          customAddress: true,
          city: {
            select: {
              name: true,
            },
          },
          primaryCategory: {
            select: {
              nameRu: true,
            },
          },
          districtAuto: {
            select: {
              name: true,
            },
          },
          districtManual: {
            select: {
              name: true,
            },
          },
          metroAuto: {
            select: {
              name: true,
            },
          },
          metroManual: {
            select: {
              name: true,
            },
          },
          ownerBusiness: {
            select: {
              operationalStatus: true,
            },
          },
          images: {
            select: {
              id: true,
              url: true,
              kind: true,
              sortOrder: true,
            },
            orderBy: {
              sortOrder: "asc",
            },
            take: 8,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 12,
      })
    : [];

  const relatedPlaces = relatedPlacesRaw
    .filter((relatedPlace) =>
      isPlacePubliclyVisible({
        status: "PUBLISHED",
        archivedAt: null,
        owner: relatedPlace.ownerBusiness
          ? { business: relatedPlace.ownerBusiness }
          : null,
      }),
    )
    .map((relatedPlace) => ({
      id: relatedPlace.id,
      title: relatedPlace.title,
      href: `/places/${relatedPlace.slug || relatedPlace.id}`,
      category:
        relatedPlace.primaryCategory?.nameRu?.trim() ||
        relatedPlace.category?.trim() ||
        undefined,
      logoUrl: resolvePlaceLogoImage(relatedPlace.images, relatedPlace.logoImageId)?.url,
      district:
        relatedPlace.districtManual?.name || relatedPlace.districtAuto?.name || undefined,
      metro: relatedPlace.metroManual?.name || relatedPlace.metroAuto?.name || undefined,
    }));

  const googleReviewsEnabled = isGoogleReviewsEnabled(
    previewGooglePlaceId,
    canReuseStoredGoogleData ? place.googleReviewsJson : null,
  );
  const googleReviewsPayload = readGoogleReviewsPayload(
    canReuseStoredGoogleData ? place.googleReviewsJson : null,
  );
  const logoImage = resolvePlaceLogoImage(previewImages, previewLogoImageId);
  const logoUrl = await resolvePlaceLogoUrlFromDb(previewImages, previewLogoImageId);
  const reelsThumbnailUrl = previewReelsUrl
    ? await fetchReelsThumbnail(previewReelsUrl)
    : null;
  const placeMedia = mapPlacePageMedia(previewImages, {
    reelsUrl: previewReelsUrl,
    reelsThumbnailUrl,
    title: displayTitle,
  });

  const now = new Date();
  const upcomingEvents = await loadUpcomingPlaceEvents({
    placeId: place.id,
    cityId: previewCityId,
    now,
    take: 10,
  });

  const activeOffers = await prisma.offer.findMany({
    where: {
      placeId: place.id,
      status: "PUBLISHED",
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      priceFrom: true,
      coverImage: true,
      kind: true,
      campProgramType: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const placeReviews = await prisma.placeReview.findMany({
    where: {
      placeId: place.id,
      status: "PUBLISHED",
    },
    select: {
      id: true,
      source: true,
      authorName: true,
      authorAvatarUrl: true,
      rating: true,
      text: true,
      publishedAt: true,
      relativeTimeDescription: true,
      ownerReplyText: true,
      ownerReplyAuthorName: true,
      ownerReplyCreatedAt: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 20,
  });

  const reviewStats = await prisma.placeReview.aggregate({
    where: {
      placeId: place.id,
      status: "PUBLISHED",
    },
    _avg: {
      rating: true,
    },
    _count: true,
  });

  const hasPersistedGoogleReviews = placeReviews.some((review) => review.source === "GOOGLE");
  const fallbackGoogleReviews = !hasPersistedGoogleReviews && googleReviewsEnabled
    ? mapStoredGoogleReviewsToPublicReviews(googleReviewsPayload?.reviews)
    : [];

  const combinedReviews = [...placeReviews, ...fallbackGoogleReviews].sort(
    (left, right) =>
      new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
  );

  const fallbackGoogleStats = getFallbackGoogleStats({
    placeGoogleRating: canReuseStoredGoogleData ? place.googleRating : null,
    placeGoogleUserRatingsTotal: canReuseStoredGoogleData
      ? place.googleUserRatingsTotal
      : null,
    googleReviews: fallbackGoogleReviews,
  });

  const averageRating = fallbackGoogleStats
    ? combineAverageRatings({
        primaryAverage: reviewStats._avg.rating,
        primaryCount: reviewStats._count,
        secondaryAverage: fallbackGoogleStats.averageRating,
        secondaryCount: fallbackGoogleStats.reviewCount,
      })
    : reviewStats._avg.rating || undefined;
  const totalReviewCount = reviewStats._count + (fallbackGoogleStats?.reviewCount ?? 0);

  const placeCitySlug = previewCity?.slug || "minsk";
  const placeCitySlugById = new Map(
    previewCityId ? [[previewCityId, placeCitySlug] as const] : [],
  );
  const eventActivities = mapUpcomingPlaceEventsToActivityMocks(upcomingEvents, {
    hubCityId: previewCityId ?? "",
    citySlugById: placeCitySlugById,
    currentUserId: user.id,
  });

  const formattedOffers = activeOffers.map((offer) => ({
    id: offer.id,
    title: offer.title,
    slug: offer.slug || offer.id,
    imageUrl: offer.coverImage || undefined,
    description: offer.description || undefined,
    price: offer.priceFrom || undefined,
    kind: offer.kind,
    campProgramType: offer.campProgramType,
  }));

  const districtName = districtManual?.name || districtAuto?.name;
  const metroName = metroManual?.name || metroAuto?.name;
  const categoryLabel =
    place.primaryCategory?.nameRu?.trim() ||
    (activeRevision ? activeRevision.category?.trim() : place.category?.trim()) ||
    undefined;
  const heroAddressRaw =
    previewFormattedAddr?.trim() || previewCustomAddress?.trim() || "";
  const resolvedInstagramUrl =
    resolveInstagramProfileHref(previewInstagramUrl, previewInstagramHandle) || undefined;
  const marketplaceAddress =
    formatMarketplaceHeroAddress({
      city: previewCity,
      shortAddress: place.shortAddress,
      formattedAddr: previewFormattedAddr,
      customAddress: previewCustomAddress,
      floor: activeRevision ? activeRevision.floor : place.floor,
      unit: activeRevision ? activeRevision.unit : place.unit,
      unitLabel: activeRevision ? activeRevision.unitLabel : place.unitLabel,
    }) || undefined;
  const placePhones = getNormalizedPlacePhones({
    phone: previewPhone,
    phoneLabel: previewPhoneLabel,
    phone2: previewPhone2,
    phone2Label: previewPhone2Label,
    phone3: previewPhone3,
    phone3Label: previewPhone3Label,
  });

  const mapsOpenUrl = buildGoogleMapsPlaceUrl(previewLat, previewLng, heroAddressRaw);
  const mapsDirectionsUrl = buildGoogleMapsDirectionsUrl(
    previewLat,
    previewLng,
    heroAddressRaw,
  );

  const workingHoursSummary = previewOpeningHours
    ? buildPublicWorkingHoursText(previewOpeningHours, new Date())
    : undefined;

  let isOpenNow: boolean | undefined;
  let todayHoursText: string | undefined;
  if (previewOpeningHours) {
    const openingStatus = getOpeningStatus(previewOpeningHours, new Date());
    if (previewOpeningHours.mode !== "BY_APPOINTMENT") {
      isOpenNow = openingStatus.isOpen;
    }
    if (openingStatus.todayIntervals && openingStatus.todayIntervals.length > 0) {
      todayHoursText = openingStatus.todayIntervals
        .map((interval) => `${interval.startTime.slice(0, 5)} — ${interval.endTime.slice(0, 5)}`)
        .join(", ");
    }
  }

  const breadcrumbItems: Array<{ label: string; href?: string }> = [
    { label: "Главная", href: "/" },
    ...(previewCity?.slug && previewCity.name
      ? [{ label: previewCity.name, href: `/${previewCity.slug}` }]
      : [{ label: "Места", href: "/places" }]),
    { label: displayTitle },
  ];

  const faqItems = normalizeFaqItems(previewFaqItems);
  const marketplacePlaceData = {
    id: place.id,
    title: displayTitle,
    slug: place.slug || place.id,
    shortDesc: previewShortDesc,
    description: previewDescription || previewShortDesc,
    logoUrl: logoUrl ?? logoImage?.url,
    rating: averageRating,
    reviewCount: totalReviewCount,
    phones: placePhones,
    website: previewWebsite || undefined,
    instagramUrl: resolvedInstagramUrl,
    address: marketplaceAddress,
    city: previewCity?.name,
    district: districtName || undefined,
    metro: metroName || undefined,
    latitude: previewLat || undefined,
    longitude: previewLng || undefined,
    categoryLabel,
    breadcrumbItems,
    mapsOpenUrl,
    mapsDirectionsUrl,
    workingHoursSummary,
    isOpenNow,
    todayHoursText,
    fallbackUrl: `/${previewCity?.slug || "minsk"}`,
    media: placeMedia,
    priceData: parsePriceData(place.priceItems),
    faqItems,
    updatedAt: activeRevision?.updatedAt ?? place.updatedAt,
  };

  return (
    <>
      <ContentPreviewBanner
        label={previewLabel}
        editHref={editorPlaceEditHref(place.id)}
        hint={previewBannerHint}
      />
      <MarketplacePlacePage
        place={marketplacePlaceData}
        eventActivities={eventActivities}
        citySlug={placeCitySlug}
        offers={formattedOffers}
        reviews={combinedReviews}
        ownerEditPlaceId={place.id}
        relatedPlaces={relatedPlaces}
        sectionNotes={{
          reviews: "Опубликованные отзывы",
          offers: "Опубликованные предложения места",
          events: "Опубликованные события",
          relatedPlaces: "Опубликованные места сети",
        }}
      />
    </>
  );
}

function mapStoredGoogleReviewsToPublicReviews(
  reviews: StoredGoogleReview[] | undefined,
) {
  if (!reviews || reviews.length === 0) {
    return [];
  }

  return reviews.map((review, index) => ({
    id: `google-json-${index}-${review.publishTime}`,
    source: "GOOGLE" as const,
    authorName: review.authorName,
    authorAvatarUrl: review.authorPhotoUri ?? null,
    rating: review.rating,
    text: review.originalText ?? review.text ?? null,
    publishedAt: review.publishTime,
    relativeTimeDescription: null,
    ownerReplyText: null,
    ownerReplyAuthorName: null,
    ownerReplyCreatedAt: null,
  }));
}

function getFallbackGoogleStats(input: {
  placeGoogleRating: number | null;
  placeGoogleUserRatingsTotal: number | null;
  googleReviews: Array<{ rating: number }> | undefined;
}): { averageRating: number; reviewCount: number } | null {
  if (
    input.placeGoogleRating != null &&
    input.placeGoogleUserRatingsTotal != null &&
    input.placeGoogleUserRatingsTotal > 0
  ) {
    return {
      averageRating: input.placeGoogleRating,
      reviewCount: input.placeGoogleUserRatingsTotal,
    };
  }

  if (!input.googleReviews || input.googleReviews.length === 0) {
    return null;
  }

  const reviewCount = input.googleReviews.length;
  const averageRating =
    input.googleReviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount;

  return { averageRating, reviewCount };
}

function combineAverageRatings(input: {
  primaryAverage: number | null;
  primaryCount: number;
  secondaryAverage: number;
  secondaryCount: number;
}): number | undefined {
  const weightedPrimary = input.primaryAverage != null
    ? input.primaryAverage * input.primaryCount
    : 0;
  const totalCount = input.primaryCount + input.secondaryCount;

  if (totalCount === 0) {
    return undefined;
  }

  return (weightedPrimary + input.secondaryAverage * input.secondaryCount) / totalCount;
}

function buildGoogleMapsPlaceUrl(
  lat?: number | null,
  lng?: number | null,
  addressRaw?: string | null,
) {
  if (lat != null && lng != null) {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }
  const address = addressRaw?.trim();
  if (address) return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  return undefined;
}

function buildGoogleMapsDirectionsUrl(
  lat?: number | null,
  lng?: number | null,
  addressRaw?: string | null,
) {
  if (lat != null && lng != null) {
    return `https://maps.google.com/maps?daddr=${lat},${lng}`;
  }
  const address = addressRaw?.trim();
  if (address) return `https://maps.google.com/maps?daddr=${encodeURIComponent(address)}`;
  return undefined;
}
