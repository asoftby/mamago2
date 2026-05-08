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

  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
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

export default async function OfferPage({ params }: OfferPageProps) {
  const { slug } = await params;
  const isLegacyId = slug.length > 20 && !slug.includes("-");

  if (isLegacyId) {
    const offer = await prisma.offer.findUnique({
      where: { id: slug },
      select: { slug: true },
    });
    if (!offer) notFound();
    if (offer.slug) permanentRedirect(`/offers/${offer.slug}`);
    notFound();
  }

  const resolved = await findOfferBySlug(slug);
  if (!resolved) notFound();

  const offer = await prisma.offer.findUnique({
    where: { id: resolved.offerId },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      coverImage: true,
      priceFrom: true,
      priceText: true,
      seoJsonLdOverride: true,
      place: { select: { id: true, title: true, cityId: true } },
    },
  });
  if (!offer) notFound();

  if (resolved.isRedirect && offer.slug) {
    permanentRedirect(`/offers/${offer.slug}`);
  }

  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
  const jsonLd =
    offer.seoJsonLdOverride && typeof offer.seoJsonLdOverride === "object"
      ? (offer.seoJsonLdOverride as Record<string, unknown>)
      : buildOfferJsonLd({
          offer: {
            title: offer.title,
            description: offer.description,
            slug: offer.slug,
            priceFrom: offer.priceFrom,
            priceText: offer.priceText,
            coverImage: offer.coverImage,
          },
          place: null,
          publicBase,
        });

  return (
    <div className="min-h-screen bg-gray-50">
      <AnalyticsDetailBeacon
        entityType="OFFER"
        entityId={offer.id}
        vertical="CITY"
        cityId={offer.place?.cityId ?? null}
      />
      <script
        type="application/ld+json"
         
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm p-6">
          <h1 className="text-2xl font-semibold">{offer.title}</h1>
          {offer.place?.title && (
            <p className="text-sm text-muted-foreground mt-1">
              Место: {offer.place.title}
            </p>
          )}
          {offer.description && (
            <div className="mt-4">
              <RichContentRenderer html={offer.description} />
            </div>
          )}
        </div>

        <Link href="/" className="text-sm text-primary hover:underline">
          На главную
        </Link>
      </div>
    </div>
  );
}

