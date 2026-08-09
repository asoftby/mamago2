import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { findOfferBySlug } from "@/lib/slug/offerSlugService";
import { buildOfferStructuredData } from "@/lib/seo/schema/buildOfferStructuredData";
import { buildBreadcrumbJsonLd } from "@/lib/seo/schema/buildBreadcrumbJsonLd";
import { buildFaqJsonLd } from "@/lib/seo/schema/buildFaqJsonLd";
import { JsonLd } from "@/components/seo/JsonLd";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { getOfferPublicPath, getOfferPublicSection, parseOfferPublicSection } from "@/lib/offers/offerPublicUrl";
import { resolveOfferCanonicalUrl } from "@/lib/seo/resolveOfferCanonicalUrl";
import { getOfferPageData } from "@/lib/offer/offerPageData";
import { OfferPageView } from "@/components/offers";
import { getCurrentUser } from "@/lib/auth/server";
import { canShowOfferOwnerEditOnPublicPage } from "@/lib/permissions/offerEditPermissions";
import { mockSummerCamp, mockLesnayaSkazka } from "@/lib/offer/offerPageMock";
import { resolveOfferStructuredDataType } from "@/lib/seo/schema/buildOfferJsonLd";
import { isOfferPubliclyVisible } from "@/lib/offers/offerVisibility";
import { tryResolvePublicationForCta } from "@/server/services/direct/directThread.service";
import { PublicationType } from "@prisma/client";

interface PageProps {
  params: Promise<{ city: string; section: string; slug: string }>;
  searchParams: Promise<{ mock?: string }>;
}

function parseRobots(s: string | null | undefined): Metadata["robots"] | undefined {
  const raw = (s ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  const parts = raw.split(",").map((x) => x.trim());
  const index = parts.includes("noindex") ? false : parts.includes("index") ? true : undefined;
  const follow = parts.includes("nofollow") ? false : parts.includes("follow") ? true : undefined;
  return { index, follow };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, section: sectionSlug, slug } = await params;
  
  const resolved = await findOfferBySlug(slug);
  if (!resolved) return { title: "Offer Not Found" };

  const offer = await prisma.offer.findUnique({
    where: { id: resolved.offerId },
    select: {
      id: true,
      slug: true,
      kind: true,
      campProgramType: true,
      title: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      seoCanonicalUrl: true,
      seoOgTitle: true,
      seoOgDescription: true,
      seoOgImage: true,
      seoRobots: true,
      coverImage: true,
      status: true,
      archivedAt: true,
      place: {
        select: {
          title: true,
          archivedAt: true,
          ownerBusiness: { select: { operationalStatus: true } },
          city: { select: { slug: true } },
        },
      },
    },
  });

  if (!offer || !isOfferPubliclyVisible(offer)) {
    return { title: "Offer Not Found" };
  }

  const publicBase = getCanonicalPublicAppUrl();
  const title = offer.seoTitle?.trim() || offer.title;
  const description = offer.seoDescription?.trim() || offer.description || "";

  // Always resolve against the Offer's own city, never the URL's — the URL
  // city can be wrong (or a nonsense value) and must not leak into the
  // canonical (see CityPlaceRedirectPage for the same class of bug on Place).
  const actualCitySlug = offer.place?.city?.slug || "minsk";
  const canonical = resolveOfferCanonicalUrl({
    seoCanonicalUrl: offer.seoCanonicalUrl,
    offer,
    citySlug: actualCitySlug,
    publicBase,
  });

  return {
    ...buildOgMeta({
      title,
      description,
      image: offer.seoOgImage?.trim() || offer.coverImage,
      url: canonical,
      robots: parseRobots(offer.seoRobots) ?? { index: true, follow: true },
    }),
    alternates: { canonical },
  };
}

export default async function CanonicalOfferPage({ params, searchParams }: PageProps) {
  const { city, section: sectionSlug, slug } = await params;
  const { mock } = await searchParams;

  // Mock mode: ?mock=1 or ?mock=lesnaya-skazka
  if (mock === "lesnaya-skazka") {
    return <OfferPageView data={mockLesnayaSkazka} canEditOffer={false} />;
  }
  if (mock === "1") {
    return <OfferPageView data={mockSummerCamp} canEditOffer={false} />;
  }

  // 1. Валидация секции
  const parsedSection = parseOfferPublicSection(sectionSlug);
  if (!parsedSection) notFound();

  // 2. Поиск оффера и маппинг данных
  const data = await getOfferPageData({ citySlug: city, section: sectionSlug, slug });
  if (!data) notFound();

  // 3. Проверка каноничности URL (если маппер вернул данные, значит slug верный)
  const resolved = await findOfferBySlug(slug);
  if (!resolved) notFound();
  
  const offer = await prisma.offer.findUnique({
      where: { id: resolved.offerId },
      select: {
        id: true,
        slug: true,
        kind: true,
        campProgramType: true,
        title: true,
        description: true,
        priceFrom: true,
        priceText: true,
        coverImage: true,
        seoJsonLdOverride: true,
        status: true,
        archivedAt: true,
        placeId: true,
        place: { 
          select: { 
            id: true, 
            title: true, 
            slug: true,
            archivedAt: true,
            ownerBusiness: { select: { operationalStatus: true } },
            createdByUserId: true,
            ownerBusinessId: true,
            city: { select: { slug: true } }
          } 
        },
      },
    });
  if (!offer || !isOfferPubliclyVisible(offer)) notFound();

  const user = await getCurrentUser();
  let canEditOffer = false;
  if (user && offer.place) {
    canEditOffer = await canShowOfferOwnerEditOnPublicPage(user, offer.place);
  }

  const canonicalSection = getOfferPublicSection(offer);
  // The Offer's own city — never the URL's. getOfferPageData() above only
  // filters by slug, not city, so a wrong (or nonsense) city segment would
  // otherwise still resolve the offer and, worse, get baked into the
  // "canonical" computed from it.
  const actualCitySlug = offer.place?.city?.slug || "minsk";

  // Редирект на единственный канонический URL, если city, секция или slug не совпадают
  if (actualCitySlug !== city || canonicalSection !== sectionSlug || resolved.isRedirect) {
    const canonicalPath = getOfferPublicPath(offer, actualCitySlug);
    permanentRedirect(canonicalPath);
  }

  const publicBase = getCanonicalPublicAppUrl();
  const canonicalPath = getOfferPublicPath(offer, actualCitySlug);
  const canonicalUrl = `${publicBase}${canonicalPath}`;
  
  // 1. Offer JSON-LD
  const offerJsonLd =
    offer.seoJsonLdOverride && typeof offer.seoJsonLdOverride === "object"
      ? (offer.seoJsonLdOverride as Record<string, unknown>)
      : buildOfferStructuredData({
          canonicalUrl,
          publicType: resolveOfferStructuredDataType(offer),
          title: offer.title,
          description: offer.description,
          image: offer.coverImage,
          price: offer.priceFrom,
          priceText: offer.priceText,
          priceCurrency: "BYN",
          place: offer.place
            ? {
                name: offer.place.title,
                slug: offer.place.slug,
                url: offer.place.slug ? `/places/${offer.place.slug}` : undefined,
              }
            : null,
          publicBaseUrl: publicBase,
        });

  // 2. BreadcrumbList JSON-LD
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    [
      { name: "Главная", path: "/" },
      { name: city, path: `/${city}` },
      { name: "Предложения", path: `/${city}/offers` },
      { name: data.title, path: canonicalPath },
    ],
    publicBase,
  );

  // 3. VideoObject JSON-LD (если есть видео)
  const videoJsonLd = data.media.videoUrl ? {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": data.media.videoLabel || data.title,
    "description": data.shortDescription || data.title,
    "thumbnailUrl": data.media.videoThumbnail || data.media.posterUrl,
    "contentUrl": data.media.videoUrl,
    "embedUrl": data.media.videoUrl,
  } : null;
  const faqJsonLd = buildFaqJsonLd(data.faqItems);

  // Direct CTA — omitted when the offer has no resolvable owning Business (rule 5).
  const directPublication = await tryResolvePublicationForCta({
    publicationType: PublicationType.OFFER,
    offerId: offer.id,
  });
  const directCta = directPublication
    ? {
        offerId: offer.id,
        publicationTitle: data.title,
        brandName: offer.place?.title || directPublication.business.name,
      }
    : undefined;

  return (
    <>
      <AnalyticsDetailBeacon
        entityType="OFFER"
        entityId={data.id}
        vertical="CITY"
        citySlug={actualCitySlug}
      />
      <JsonLd
        data={
          [offerJsonLd, breadcrumbJsonLd, videoJsonLd, faqJsonLd].filter(Boolean) as Record<
            string,
            unknown
          >[]
        }
      />
      <OfferPageView data={data} canEditOffer={canEditOffer} direct={directCta} />
    </>
  );
}
