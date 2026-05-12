import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { findOfferBySlug } from "@/lib/slug/offerSlugService";
import { buildOfferJsonLd } from "@/lib/seo/schema/buildOfferJsonLd";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { getOfferPublicPath, getOfferPublicSection, parseOfferPublicSection } from "@/lib/offers/offerPublicUrl";
import { getOfferPageData } from "@/lib/offer/offerPageData";
import { OfferPageView } from "@/components/offers";

interface PageProps {
  params: Promise<{ city: string; section: string; slug: string }>;
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
      place: { select: { title: true, city: { select: { slug: true } } } },
    },
  });

  if (!offer) return { title: "Offer Not Found" };

  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
  const title = offer.seoTitle?.trim() || offer.title;
  const description = offer.seoDescription?.trim() || offer.description || "";
  
  const canonicalPath = getOfferPublicPath(offer, city);
  const canonical = offer.seoCanonicalUrl?.trim() || `${publicBase}${canonicalPath}`;

  return {
    ...buildOgMeta({
      title,
      description,
      image: offer.seoOgImage?.trim() || offer.coverImage,
      url: canonical,
      robots: parseRobots(offer.seoRobots) ?? { index: true, follow: true },
    }),
    alternates: offer.seoCanonicalUrl?.trim() ? { canonical: offer.seoCanonicalUrl.trim() } : undefined,
  };
}

export default async function CanonicalOfferPage({ params }: PageProps) {
  const { city, section: sectionSlug, slug } = await params;

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
        seoJsonLdOverride: true,
        placeId: true,
        place: { 
          select: { 
            id: true, 
            title: true, 
            slug: true,
            city: { select: { slug: true } }
          } 
        },
      },
    });
  if (!offer) notFound();

  const canonicalSection = getOfferPublicSection(offer as any);
  
  // Если секция в URL не совпадает с канонической или если это редирект по слагу
  if (canonicalSection !== sectionSlug || resolved.isRedirect) {
    const canonicalPath = getOfferPublicPath(offer as any, city);
    permanentRedirect(canonicalPath);
  }

  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
  
  // 1. Offer JSON-LD
  const offerJsonLd =
    offer.seoJsonLdOverride && typeof offer.seoJsonLdOverride === "object"
      ? (offer.seoJsonLdOverride as Record<string, unknown>)
      : buildOfferJsonLd({
          offer: data as any,
          place: data.place as any,
          citySlug: city,
          publicBase,
        });

  // 2. BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Главная",
        "item": publicBase
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": city,
        "item": `${publicBase}/${city}`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Предложения",
        "item": `${publicBase}/${city}/offers`
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": data.title,
        "item": `${publicBase}${getOfferPublicPath(offer as any, city)}`
      }
    ]
  };

  // 3. VideoObject JSON-LD (если есть видео)
  const videoJsonLd = data.media.videoUrl ? {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": data.media.videoLabel || data.title,
    "description": data.shortDescription || data.title,
    "thumbnailUrl": data.media.videoThumbnail || data.media.posterUrl,
    "uploadDate": new Date().toISOString(), // Fallback
    "contentUrl": data.media.videoUrl,
    "embedUrl": data.media.videoUrl,
  } : null;

  return (
    <>
      <AnalyticsDetailBeacon
        entityType="OFFER"
        entityId={data.id}
        vertical="CITY"
        cityId={offer.placeId}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(offerJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {videoJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
        />
      )}
      <OfferPageView data={data} />
    </>
  );
}
