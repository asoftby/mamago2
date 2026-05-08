import { notFound, permanentRedirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Metadata } from "next";
import { getPlaceDisplayTitle } from "@/lib/placeDisplayTitle";
import { findPlaceBySlug } from "@/lib/slug/placeSlugService";
import { formatMarketplaceHeroAddress, getPlaceLocationString } from "@/lib/placeLocationString";
import { isPlacePubliclyVisible } from "@/lib/plan/publicVisibility";
import { buildPlaceJsonLd } from "@/lib/seo/schema/buildPlaceJsonLd";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { MarketplacePlacePage } from "@/components/place/marketplace";
import { getCurrentUser } from "@/lib/auth/server";
import { resolveInstagramProfileHref } from "@/lib/instagram/extractUsername";
import { buildPublicWorkingHoursText } from "@/server/services/openingHours/openingHours.publicSummary";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";

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
    images: { url: string; kind: string; sortOrder: number }[];
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
        images: {
          select: { url: true, kind: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
          take: 3,
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
        images: {
          select: { url: true, kind: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
          take: 3,
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

  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
  const coverImage =
    place.seoOgImage?.trim() ||
    place.images.find((i) => i.kind === "GALLERY")?.url ||
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

  // Get formatted location string
  const locationString = getPlaceLocationString(place);

  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
  const jsonLd =
    place.seoJsonLdOverride && typeof place.seoJsonLdOverride === "object"
      ? (place.seoJsonLdOverride as Record<string, unknown>)
      : buildPlaceJsonLd({
          place: {
            title: place.title,
            description: place.description,
            slug: place.slug,
            formattedAddr: place.formattedAddr,
            customAddress: place.customAddress,
          },
          publicBase,
        });

  const logoImage = place.images.find((img) => img.kind === "LOGO");
  const galleryImages = place.images
    .filter((img) => img.kind === "GALLERY")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((img) => ({
      id: img.id,
      url: img.url,
      alt: place.title,
    }));

  // Fetch upcoming events for this place
  const upcomingEvents = await prisma.activity.findMany({
    where: {
      placeId: place.id,
      type: "EVENT",
      status: "PUBLISHED",
      nextOccurrenceAt: {
        gte: new Date(),
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      nextOccurrenceAt: true,
      coverImageUrl: true,
      priceFrom: true,
      eventCategory: {
        select: { nameRu: true },
      },
    },
    orderBy: { nextOccurrenceAt: "asc" },
    take: 10,
  });

  // Fetch active offers for this place
  const activeOffers = await prisma.activity.findMany({
    where: {
      placeId: place.id,
      type: "OFFER",
      status: "PUBLISHED",
    },
    select: {
      id: true,
      title: true,
      slug: true,
      shortDesc: true,
      priceFrom: true,
      coverImageUrl: true,
      eventCategory: {
        select: { nameRu: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Fetch published reviews from PlaceReview
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
    take: 20, // Показываем последние 20 отзывов
  });

  // Calculate average rating from PlaceReview
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

  const averageRating = reviewStats._avg.rating || undefined;
  const totalReviewCount = reviewStats._count;

  // Check if current user can edit this place
  const currentUser = await getCurrentUser();
  let canEdit = false;

  if (currentUser) {
    // ADMIN can edit any place
    if (currentUser.role === "ADMIN") {
      canEdit = true;
    }
    // Check if user owns the business that owns this place
    else if (place.ownerBusinessId && place.ownerBusiness) {
      const isBusinessOwner = place.ownerBusiness.ownerUserId === currentUser.id;
      const isBusinessMember = place.ownerBusiness.members.some(
        (member) => member.userId === currentUser.id
      );
      canEdit = isBusinessOwner || isBusinessMember;
    }
  }

  // Format data for premium components
  const formattedEvents = upcomingEvents.map((event) => ({
    id: event.id,
    title: event.title,
    slug: event.slug || event.id,
    imageUrl: event.coverImageUrl || undefined,
    startDate: event.nextOccurrenceAt?.toISOString() || new Date().toISOString(),
    location: locationString || undefined,
    price: event.priceFrom || undefined,
    category: event.eventCategory?.nameRu,
  }));

  const formattedOffers = activeOffers.map((offer) => ({
    id: offer.id,
    title: offer.title,
    slug: offer.slug || offer.id,
    imageUrl: offer.coverImageUrl || undefined,
    description: offer.shortDesc || undefined,
    price: offer.priceFrom || undefined,
    category: offer.eventCategory?.nameRu,
  }));

  // Get district and metro names
  const districtName = place.districtManual?.name || place.districtAuto?.name;
  const metroName = place.metroManual?.name || place.metroAuto?.name;

  const categoryLabel =
    place.primaryCategory?.nameRu?.trim() || place.category?.trim() || undefined;

  const heroAddressRaw =
    place.formattedAddr?.trim() || place.customAddress?.trim() || "";

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

  const breadcrumbItems: Array<{ label: string; href?: string }> = [
    { label: "Главная", href: "/" },
    ...(place.city?.slug && place.city.name
      ? [{ label: place.city.name, href: `/${place.city.slug}` }]
      : [{ label: "Места", href: "/places" }]),
    { label: displayTitle },
  ];

  // Prepare place data for marketplace component
  const marketplacePlaceData = {
    id: place.id,
    title: displayTitle,
    slug: place.slug || place.id,
    shortDesc: place.shortDesc,
    description: place.description || place.shortDesc,
    logoUrl: logoImage?.url,
    rating: averageRating,
    reviewCount: totalReviewCount,
    
    // Contact
    phone: place.phone || undefined,
    website: place.website || undefined,
    instagramUrl:
      resolveInstagramProfileHref(place.instagramUrl, place.instagramHandle) || undefined,
    
    // Location
    address:
      formatMarketplaceHeroAddress({
        city: place.city,
        shortAddress: place.shortAddress,
        formattedAddr: place.formattedAddr,
        customAddress: place.customAddress,
        floor: place.floor,
        unit: place.unit,
        unitLabel: place.unitLabel,
      }) || undefined,
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

    // Media
    images: galleryImages.length > 0 ? galleryImages : undefined,
  };

  return (
    <>
      <AnalyticsDetailBeacon
        entityType="PLACE"
        entityId={place.id}
        vertical="CITY"
        cityId={place.cityId}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketplacePlacePage
        place={marketplacePlaceData}
        events={formattedEvents}
        offers={formattedOffers}
        reviews={placeReviews}
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
