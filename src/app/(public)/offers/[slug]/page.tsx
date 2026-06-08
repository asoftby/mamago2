import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { findOfferBySlug } from "@/lib/slug/offerSlugService";
import { buildOfferJsonLd } from "@/lib/seo/schema/buildOfferJsonLd";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { RichContentRenderer } from "@/components/content/RichContentRenderer";

interface OfferPageProps {
  params: Promise<{ slug: string }>;
}

function parseRobots(s: string | null | undefined): Metadata["robots"] | undefined {
  const raw = (s ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  const parts = raw.split(",").map((x) => x.trim());
  const index = parts.includes("noindex") ? false : parts.includes("index") ? true : undefined;
  const follow = parts.includes("nofollow") ? false : parts.includes("follow") ? true : undefined;
  return { index, follow };
}

export async function generateMetadata({ params }: OfferPageProps): Promise<Metadata> {
  const { slug } = await params;
  const isLegacyId = slug.length > 20 && !slug.includes("-");

  const offer = isLegacyId
    ? await prisma.offer.findUnique({
        where: { id: slug },
        select: {
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
          place: { select: { title: true } },
        },
      })
    : await (async () => {
        const r = await findOfferBySlug(slug);
        if (!r) return null;
        return prisma.offer.findUnique({
          where: { id: r.offerId },
          select: {
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
            place: { select: { title: true } },
          },
        });
      })();

  if (!offer) return { title: "Offer Not Found" };

  const publicBase = getCanonicalPublicAppUrl();
  const title = offer.seoTitle?.trim() || offer.title;
  const description = offer.seoDescription?.trim() || offer.description || "";
  const canonical =
    offer.seoCanonicalUrl?.trim() ||
    (offer.slug ? `${publicBase}/offers/${offer.slug}` : `${publicBase}/offers/${offer.id}`);

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

import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";

export default async function OfferPage({ params }: OfferPageProps) {
  const { slug } = await params;
  
  // Всегда редиректим на новый канонический путь
  const resolved = await findOfferBySlug(slug);
  if (!resolved) notFound();

  const offer = await prisma.offer.findUnique({
    where: { id: resolved.offerId },
    select: {
      id: true,
      slug: true,
      kind: true,
      campProgramType: true,
      place: { 
        select: { 
          city: { select: { slug: true } }
        } 
      },
    },
  });
  
  if (!offer) notFound();
  
  const citySlug = offer.place?.city?.slug || "minsk";
  const canonicalPath = getOfferPublicPath(offer, citySlug);
  
  permanentRedirect(canonicalPath);
}
