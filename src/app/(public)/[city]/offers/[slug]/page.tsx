import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { findOfferBySlug, findOfferBySlugInCity } from "@/lib/slug/offerSlugService";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { buildOfferStructuredData } from "@/lib/seo/schema/buildOfferStructuredData";
import { buildBreadcrumbJsonLd } from "@/lib/seo/schema/buildBreadcrumbJsonLd";
import { buildFaqJsonLd } from "@/lib/seo/schema/buildFaqJsonLd";
import { JsonLd } from "@/components/seo/JsonLd";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
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

/**
 * `/{city}/offers/{slug}` — the canonical Offer detail page.
 *
 * `{section}` is deliberately not part of this URL — it's a mutable
 * product taxonomy/filter concept (`getOfferPublicSection`), not the
 * Offer's permanent identity. See
 * `docs/migration/seo/final-url-architecture-2026-08-15.md` §3,
 * BACKLOG-116.
 *
 * `Offer.slug` is only unique per-city (`@@unique([cityId, slug])`), so
 * the primary lookup is city-scoped (`findOfferBySlugInCity`, filtered by
 * `Offer.cityId`). `Offer.cityId` is a snapshot field that isn't always
 * reliably populated for business-created Offers (BACKLOG-114) — when the
 * scoped lookup misses, this falls back to a global lookup to find the
 * Offer's actual city (via its Place, matching the rest of this codebase's
 * convention). If that actual city already matches the requested URL, the
 * page still renders (never redirects to the exact URL it's already on —
 * that would loop); it only redirects when the city truly differs.
 */
interface PageProps {
  params: Promise<{ city: string; slug: string }>;
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

const offerMetaSelect = {
  id: true,
  slug: true,
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
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: citySlug, slug } = await params;

  const city = await findCityBySlug(citySlug, { select: { id: true, slug: true } });
  if (!city) notFound();

  const scoped = await findOfferBySlugInCity(city.id, slug);
  const resolved = scoped ?? (await findOfferBySlug(slug));
  if (!resolved) notFound();

  const offer = await prisma.offer.findUnique({ where: { id: resolved.offerId }, select: offerMetaSelect });
  if (!offer || !isOfferPubliclyVisible(offer)) {
    notFound();
  }

  const publicBase = getCanonicalPublicAppUrl();
  const title = offer.seoTitle?.trim() || offer.title;
  const description = offer.seoDescription?.trim() || offer.description || "";

  // Always resolve against the Offer's own city, never the URL's.
  const actualCitySlug = offer.place?.city?.slug || city.slug;
  const canonical = resolveOfferCanonicalUrl({
    seoCanonicalUrl: offer.seoCanonicalUrl,
    slug: offer.slug,
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
  const { city: citySlug, slug } = await params;
  const { mock } = await searchParams;

  // Mock mode: ?mock=1 or ?mock=lesnaya-skazka
  if (mock === "lesnaya-skazka") {
    return <OfferPageView data={mockLesnayaSkazka} canEditOffer={false} />;
  }
  if (mock === "1") {
    return <OfferPageView data={mockSummerCamp} canEditOffer={false} />;
  }

  const city = await findCityBySlug(citySlug, { select: { id: true, slug: true } });
  if (!city) notFound();

  // City-scoped lookup first (BACKLOG-116) — falls back to a global
  // lookup only to find the offer's real city; see file doc comment for
  // why a city match there renders instead of redirecting.
  const scoped = await findOfferBySlugInCity(city.id, slug);
  const resolved = scoped ?? (await findOfferBySlug(slug));
  if (!resolved) notFound();

  const offer = await prisma.offer.findUnique({
    where: { id: resolved.offerId },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      priceFrom: true,
      priceText: true,
      coverImage: true,
      kind: true,
      campProgramType: true,
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
          city: { select: { slug: true } },
        },
      },
    },
  });
  if (!offer || !isOfferPubliclyVisible(offer)) notFound();

  const user = await getCurrentUser();
  let canEditOffer = false;
  if (user && offer.place) {
    canEditOffer = await canShowOfferOwnerEditOnPublicPage(user, offer.place);
  }

  // The Offer's own city — never the URL's. Falls back to the requested
  // city only if the offer truly has none resolvable (edge case).
  const actualCitySlug = offer.place?.city?.slug || city.slug;

  // Redirect only when the offer's real city differs from the URL's, or
  // the slug is a retired one — never when everything already matches
  // (that would loop, since `resolved` can come from the unscoped
  // fallback when `Offer.cityId` is stale/null but the URL city is
  // already correct).
  if (actualCitySlug !== city.slug || resolved.isRedirect) {
    permanentRedirect(getOfferPublicPath({ slug: offer.slug }, actualCitySlug));
  }

  const data = await getOfferPageData({ citySlug: actualCitySlug, slug: offer.slug ?? slug });
  if (!data) notFound();

  const publicBase = getCanonicalPublicAppUrl();
  const canonicalPath = getOfferPublicPath({ slug: offer.slug }, actualCitySlug);
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
                url: offer.place.slug && offer.place.city?.slug
                  ? `/${offer.place.city.slug}/places/${offer.place.slug}`
                  : undefined,
              }
            : null,
          publicBaseUrl: publicBase,
        });

  // 2. BreadcrumbList JSON-LD
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    [
      { name: "Главная", path: "/" },
      { name: actualCitySlug, path: `/${actualCitySlug}` },
      { name: "Предложения", path: `/${actualCitySlug}/offers` },
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
