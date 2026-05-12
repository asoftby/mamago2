import { notFound } from "next/navigation";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { OfferPageView } from "@/components/offers/OfferPageView";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";
import { resolveActivityVertical } from "@/lib/public/publicVerticalResolver";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { transformActivityToOfferPageData } from "@/server/services/offer/offerPageDataTransformer";

interface ProgramPageProps {
  params: Promise<{
    city: string;
    slug: string;
  }>;
}

async function getProgramData(slug: string, citySlug: string): Promise<OfferPageData | null> {
  // Find activity by slug
  const activity = await prisma.activity.findUnique({
    where: { slug },
    include: {
      place: {
        select: {
          id: true,
          title: true,
          slug: true,
          formattedAddr: true,
          customAddress: true,
          shortAddress: true,
          lat: true,
          lng: true,
          districtManual: { select: { name: true } },
          districtAuto: { select: { name: true } },
          metroManual: { select: { name: true } },
          metroAuto: { select: { name: true } },
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          url: true,
          width: true,
          height: true,
          blurhash: true,
        },
      },
      coverImage: {
        select: {
          id: true,
          publicUrl: true,
          width: true,
          height: true,
        },
      },
    },
  });

  if (!activity) {
    return null;
  }

  // Verify this is a PROGRAM vertical activity
  const vertical = resolveActivityVertical(activity.type, null);
  if (vertical !== "PROGRAM") {
    return null;
  }

  // Only show published activities
  if (activity.status !== "PUBLISHED") {
    return null;
  }

  // Transform Activity to OfferPageData
  return transformActivityToOfferPageData(activity, citySlug);
}

export async function generateMetadata({ params }: ProgramPageProps): Promise<Metadata> {
  const { slug, city } = await params;
  const data = await getProgramData(slug, city);

  if (!data) {
    return {
      title: "Программа не найдена",
    };
  }

  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";

  return {
    title: data.seo.title || data.title,
    description: data.seo.description || data.shortDescription,
    openGraph: {
      title: data.seo.ogTitle || data.title,
      description: data.seo.ogDescription || data.shortDescription,
      images: data.seo.ogImage ? [{ url: data.seo.ogImage }] : undefined,
      type: "website",
      url: `${publicBase}/${city}/programs/${slug}`,
    },
    alternates: {
      canonical: data.seo.canonicalUrl || `${publicBase}/${city}/programs/${slug}`,
    },
  };
}

export default async function ProgramPage({ params }: ProgramPageProps) {
  const { slug, city } = await params;
  const data = await getProgramData(slug, city);

  if (!data) {
    notFound();
  }

  return (
    <>
      <AnalyticsDetailBeacon
        entityType="OFFER"
        entityId={data.id}
        vertical="EDUCATION"
        cityId={null}
      />
      <OfferPageView data={data} />
    </>
  );
}
