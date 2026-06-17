import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { notFound, permanentRedirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPlaceDisplayTitle } from "@/lib/placeDisplayTitle";
import { findPlaceBySlug } from "@/lib/slug/placeSlugService";
import { formatMarketplaceHeroAddress } from "@/lib/placeLocationString";
import { isPlacePubliclyVisible } from "@/lib/plan/publicVisibility";
import { buildBreadcrumbJsonLd } from "@/lib/seo/schema/buildBreadcrumbJsonLd";
import { buildPlaceJsonLd } from "@/lib/seo/schema/buildPlaceJsonLd";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { MarketplacePlacePage } from "@/components/place/marketplace";
import { getCurrentUser } from "@/lib/auth/server";
import { canEditPlace } from "@/lib/permissions/placeEditPermissions";
import { resolveInstagramProfileHref } from "@/lib/instagram/extractUsername";
import { buildPublicWorkingHoursText } from "@/server/services/openingHours/openingHours.publicSummary";
import { getOpeningStatus } from "@/server/services/openingHours/openingHours.service";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";
import { resolvePlaceLogoImage } from "@/lib/place/resolvePlaceLogoImage";
import { resolvePlaceLogoUrlFromDb } from "@/lib/place/resolvePlaceLogoUrlFromDb";
import { parsePriceData } from "@/lib/priceItems";
import { isGoogleReviewsEnabled } from "@/lib/place/googleReviewsMeta";
import {
  loadUpcomingPlaceEvents,
  mapUpcomingPlaceEventsToActivityMocks,
} from "@/lib/place/loadUpcomingPlaceEvents";

interface PlacePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { slug } = await params;
  
  // Check if it's a legacy ID (cuid format)
  const isLegacyId = slug.length > 20 && !slug.includes("-");
  
  let place: {
    id: string;
    title: string;
    shortDesc: string;
    seoTitle: string | null;
    seoDescription: string | null;
    seoOgImage: string | null;
    formattedAddr: string | null;
    customAddress: string | null;
    cityId: string | null;
    status: string;
    archivedAt: Date | null;
    slug: string | null;
    logoImageId: string | null;
    images: { id: string; url: string; kind: string; sortOrder: number }[];
    ownerBusiness: { operationalStatus: string } | null;
  } | null;
  
  if (isLegacyId) {
    // Legacy ID - find by id
    place = await prisma.place.findUnique({
      where: { id: slug },
      select: { 
        id: true,
        title: true, 
        shortDesc: true,
        seoTitle: true,
        seoDescription: true,
        seoOgImage: true,
        formattedAddr: true,
        customAddress: true,
        cityId: true,
        status: true,
        archivedAt: true,
        slug: true,
        logoImageId: true,
        images: {
          select: { id: true, url: true, kind: true, sortOrder: true },
          orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
          take: 24,
        },
        ownerBusiness: {
          select: {
            operationalStatus: true,
          },
        },
      },
    });
    
    // If found and has slug, this will be redirected in the page component
    if (!place) {
      return {
        title: "Place Not Found",
      };
    }
  } else {
    const slugResult = await findPlaceBySlug(slug);
    if (!slugResult) {
      return {
        title: "Place Not Found",
      };
    }
    place = await prisma.place.findUnique({
      where: { id: slugResult.placeId },
      select: { 
        id: true,
        title: true, 
        shortDesc: true,
        seoTitle: true,
        seoDescription: true,
        seoOgImage: true,
        formattedAddr: true,
        customAddress: true,
        cityId: true,
        status: true,
        archivedAt: true,
        slug: true,
        logoImageId: true,
        images: {
          select: { id: true, url: true, kind: true, sortOrder: true },
          orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
          take: 24,
        },
        ownerBusiness: {
          select: {
            operationalStatus: true,
          },
        },
      },
    });
    
    if (!place) {
      return {
        title: "Place Not Found",
      };
    }
  }

  if (!isPlacePubliclyVisible({ 
    status: place.status, 
    archivedAt: place.archivedAt, 
    owner: place.ownerBusiness ? { business: place.ownerBusiness } : null 
  })) {
    return { title: "Place Not Found" };
  }

  // Get display title with duplicate check
  const displayTitle = await getPlaceDisplayTitle(prisma, {
    id: place.id,
    title: place.title,
    formattedAddr: place.formattedAddr,
    customAddress: place.customAddress,
    shortAddress: null,
    cityId: place.cityId,
  });

  const publicBase = getCanonicalPublicAppUrl();
  const logoForMeta = resolvePlaceLogoImage(place.images, place.logoImageId);
  const coverImage =
    place.seoOgImage?.trim() ||
    place.images.find((i) => i.kind === "GALLERY")?.url ||
    logoForMeta?.url ||
    place.images[0]?.url;

  return buildOgMeta({
    title: place.seoTitle?.trim() || displayTitle,
    description: place.seoDescription?.trim() || place.shortDesc,
    image: coverImage,
    url: `${publicBase}/places/${place.slug ?? place.id}`,
  });
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { slug } = await params;
  
  // Check if it's a legacy ID (cuid format - long string without hyphens in middle)
  const isLegacyId = slug.length > 20 && !slug.includes("-");
  
  let placeId: string;
  let currentSlug: string | null = null;
  
  if (isLegacyId) {
    // Legacy ID - find by id and redirect to slug URL
    const place = await prisma.place.findUnique({
      where: { id: slug },
      select: { id: true, slug: true },
    });
    
    if (!place) {
      notFound();
    }
    
    placeId = place.id;
    currentSlug = place.slug;
    if (currentSlug) {
      permanentRedirect(`/places/${currentSlug}`);
    }
  } else {
    // Modern slug - find by current slug or historical slug
    const slugResult = await findPlaceBySlug(slug);
    
    if (!slugResult) {
      notFound();
    }
    
    placeId = slugResult.placeId;
    
    if (slugResult.isRedirect) {
      const currentPlace = await prisma.place.findUnique({
        where: { id: placeId },
        select: { slug: true },
      });
      
      if (!currentPlace?.slug) notFound();
      permanentRedirect(`/places/${currentPlace.slug}`);
    }
  }
  
  // Fetch full place data
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      images: {
        orderBy: { sortOrder: "asc" },
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
              intervals: { orderBy: { sortOrder: "asc" } },
            },
          },
          exceptions: {
            include: {
              intervals: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
      primaryCategory: {
        select: {
          nameRu: true,
        },
      },
      ownerBusiness: {
        select: {
          operationalStatus: true,
          ownerUserId: true,
          members: {
            where: {
              isActive: true,
            },
            select: {
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!place) {
    notFound();
  }

  // Only show published places
  if (place.status !== "PUBLISHED") {
    notFound();
  }

  if (!isPlacePubliclyVisible({ 
    status: place.status, 
    archivedAt: place.archivedAt, 
    owner: place.ownerBusiness ? { business: place.ownerBusiness } : null 
  })) {
    notFound();
  }

  // Get display title with duplicate check
  const displayTitle = await getPlaceDisplayTitle(prisma, {
    id: place.id,
    title: place.title,
    formattedAddr: place.formattedAddr,
    customAddress: place.customAddress,
    shortAddress: null,
    cityId: place.cityId,
  });

  const googleReviewsEnabled = isGoogleReviewsEnabled(place.googlePlaceId, place.googleReviewsJson);
  const publicBase = getCanonicalPublicAppUrl();

  const logoImage = resolvePlaceLogoImage(place.images, place.logoImageId);
  const logoUrl = await resolvePlaceLogoUrlFromDb(place.images, place.logoImageId);
  const galleryImages = place.images
    .filter((img) => img.kind === "GALLERY")
    .filter((img) => !logoImage || img.id !== logoImage.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((img) => ({
      id: img.id,
      url: img.url,
      alt: place.title,
    }));

  const now = new Date();

  // Fetch upcoming public events for this place using the same visibility rules
  // as public feeds, including session-based fallback when nextOccurrenceAt is stale.
  const upcomingEvents = await loadUpcomingPlaceEvents({
    placeId: place.id,
    cityId: place.cityId,
    now,
    take: 10,
  });

  // Fetch active offers for this place
  const activeOffers = await prisma.offer.findMany({
    where: {
      placeId: place.id,
      status: "PUBLISHED",
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

  // Fetch published reviews from PlaceReview
  const placeReviews = await prisma.placeReview.findMany({
    where: {
      placeId: place.id,
      status: "PUBLISHED",
      ...(googleReviewsEnabled ? {} : { source: { not: "GOOGLE" as const } }),
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
    take: 20, // Показываем последние 20 отзывов
  });

  // Calculate average rating from PlaceReview
  const reviewStats = await prisma.placeReview.aggregate({
    where: {
      placeId: place.id,
      status: "PUBLISHED",
      ...(googleReviewsEnabled ? {} : { source: { not: "GOOGLE" as const } }),
    },
    _avg: {
      rating: true,
    },
    _count: true,
  });

  const averageRating = reviewStats._avg.rating || undefined;
  const totalReviewCount = reviewStats._count;

  const currentUser = await getCurrentUser();
  const canShowPlaceEditor =
    currentUser != null &&
    (await canEditPlace(currentUser, {
      placeId: place.id,
      createdByUserId: place.createdByUserId,
      ownerBusinessId: place.ownerBusinessId,
      status: place.status,
    }));

  const placeCitySlug = place.city?.slug || "minsk";
  const placeCitySlugById = new Map(
    place.cityId ? [[place.cityId, placeCitySlug] as const] : [],
  );
  const eventActivities = mapUpcomingPlaceEventsToActivityMocks(upcomingEvents, {
    hubCityId: place.cityId ?? "",
    citySlugById: placeCitySlugById,
    currentUserId: currentUser?.id ?? null,
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

  // Get district and metro names
  const districtName = place.districtManual?.name || place.districtAuto?.name;
  const metroName = place.metroManual?.name || place.metroAuto?.name;

  const categoryLabel =
    place.primaryCategory?.nameRu?.trim() || place.category?.trim() || undefined;

  const heroAddressRaw =
    place.formattedAddr?.trim() || place.customAddress?.trim() || "";
  const resolvedInstagramUrl =
    resolveInstagramProfileHref(place.instagramUrl, place.instagramHandle) || undefined;
  const marketplaceAddress =
    formatMarketplaceHeroAddress({
      city: place.city,
      shortAddress: place.shortAddress,
      formattedAddr: place.formattedAddr,
      customAddress: place.customAddress,
      floor: place.floor,
      unit: place.unit,
      unitLabel: place.unitLabel,
    }) || undefined;

  const mapsOpenUrl = buildGoogleMapsPlaceUrl(place.lat, place.lng, heroAddressRaw);
  const mapsDirectionsUrl = buildGoogleMapsDirectionsUrl(
    place.lat,
    place.lng,
    heroAddressRaw,
  );

  let openingHoursResolved = place.openingHours as OpeningHoursWithRelations | null | undefined;
  if (!openingHoursResolved && place.openingHoursId) {
    openingHoursResolved = await prisma.openingHours.findUnique({
      where: { id: place.openingHoursId },
      include: {
        rules: {
          include: {
            intervals: { orderBy: { sortOrder: "asc" } },
          },
        },
        exceptions: {
          include: {
            intervals: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });
  }

  const workingHoursSummary = openingHoursResolved
    ? buildPublicWorkingHoursText(openingHoursResolved as OpeningHoursWithRelations, new Date())
    : undefined;

  let isOpenNow: boolean | undefined;
  let todayHoursText: string | undefined;
  if (openingHoursResolved) {
    const openingStatus = getOpeningStatus(
      openingHoursResolved as OpeningHoursWithRelations,
      new Date(),
    );
    if (openingHoursResolved.mode !== "BY_APPOINTMENT") {
      isOpenNow = openingStatus.isOpen;
    }
    if (openingStatus.todayIntervals && openingStatus.todayIntervals.length > 0) {
      todayHoursText = openingStatus.todayIntervals
        .map((i) => `${i.startTime.slice(0, 5)} — ${i.endTime.slice(0, 5)}`)
        .join(", ");
    }
  }

  const breadcrumbItems: Array<{ label: string; href?: string }> = [
    { label: "Главная", href: "/" },
    ...(place.city?.slug && place.city.name
      ? [{ label: place.city.name, href: `/${place.city.slug}` }]
      : [{ label: "Места", href: "/places" }]),
    { label: displayTitle },
  ];
  const canonicalPath = `/places/${place.slug ?? place.id}`;
  const canonicalUrl = `${publicBase}${canonicalPath}`;
  const jsonLd =
    place.seoJsonLdOverride && typeof place.seoJsonLdOverride === "object"
      ? (place.seoJsonLdOverride as Record<string, unknown>)
      : buildPlaceJsonLd({
          canonicalUrl,
          name: displayTitle,
          description: place.description || place.shortDesc,
          image: logoUrl || galleryImages[0]?.url,
          address: marketplaceAddress,
          lat: place.lat,
          lng: place.lng,
          phone: place.phone,
          website: place.website,
          instagramUrl: resolvedInstagramUrl,
          rating: averageRating,
          reviewCount: totalReviewCount,
          publicBaseUrl: publicBase,
        });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    [
      { name: "Главная", path: "/" },
      ...(place.city?.slug && place.city.name
        ? [{ name: place.city.name, path: `/${place.city.slug}` }]
        : []),
      { name: displayTitle, path: canonicalPath },
    ],
    publicBase,
  );

  // Prepare place data for marketplace component
  const marketplacePlaceData = {
    id: place.id,
    title: displayTitle,
    slug: place.slug || place.id,
    shortDesc: place.shortDesc,
    description: place.description || place.shortDesc,
    logoUrl: logoUrl ?? logoImage?.url,
    rating: averageRating,
    reviewCount: totalReviewCount,
    
    // Contact
    phone: place.phone || undefined,
    website: place.website || undefined,
    instagramUrl:
      resolvedInstagramUrl,

    // Location
    address: marketplaceAddress,
    city: place.city?.name,
    district: districtName || undefined,
    metro: metroName || undefined,
    latitude: place.lat || undefined,
    longitude: place.lng || undefined,
    categoryLabel,

    breadcrumbItems,
    mapsOpenUrl,
    mapsDirectionsUrl,
    workingHoursSummary,
    isOpenNow,
    todayHoursText,
    fallbackUrl: `/${place.city?.slug || "minsk"}`,

    // Media
    images: galleryImages.length > 0 ? galleryImages : undefined,

    priceData: parsePriceData(place.priceItems),
    updatedAt: place.updatedAt,
  };

  return (
    <>
      <AnalyticsDetailBeacon
        entityType="PLACE"
        entityId={place.id}
        vertical="CITY"
        cityId={place.cityId}
      />
      <JsonLd data={jsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <MarketplacePlacePage
        place={marketplacePlaceData}
        eventActivities={eventActivities}
        citySlug={placeCitySlug}
        offers={formattedOffers}
        reviews={placeReviews}
        ownerEditPlaceId={canShowPlaceEditor ? place.id : undefined}
      />
    </>
  );
}

function buildGoogleMapsPlaceUrl(
  lat?: number | null,
  lng?: number | null,
  addressRaw?: string | null,
) {
  if (lat != null && lng != null) {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }
  const a = addressRaw?.trim();
  if (a) return `https://maps.google.com/?q=${encodeURIComponent(a)}`;
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
  const a = addressRaw?.trim();
  if (a) return `https://maps.google.com/maps?daddr=${encodeURIComponent(a)}`;
  return undefined;
}
