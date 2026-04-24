import Link from "next/link";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { EventPageView } from "@/components/event-page";
import { attachSimilarEvents, buildEventPageData } from "@/lib/event/buildEventPageData";
import { MINSK_ACTIVITIES } from "@/mocks/activities.minsk";
import { loadPublicActivityForCityPage } from "@/lib/event/loadPublicActivityForCityPage";
import { ContentStatus } from "@prisma/client";
import { buildEventPageDataFromPrismaActivity } from "@/lib/event/buildEventPageDataFromPrisma";
import { getCurrentUser } from "@/lib/auth/server";
import { editorEventEditHref } from "@/lib/content-editor/types";
import { buildEventJsonLd } from "@/lib/seo/schema/buildEventJsonLd";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { resolveCanonicalEventPublicPathBySlugOrId } from "@/lib/business/resolveCanonicalEventPublicPath";

interface EventPublicPageProps {
  params: Promise<{ city: string; slugOrId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function searchParamsToSuffix(
  sp: Record<string, string | string[] | undefined> | undefined,
): string {
  if (!sp || typeof sp !== "object") return "";
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => u.append(k, x));
    else u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

function cityLabel(citySlug: string) {
  if (citySlug === "minsk") return "Минске";
  return citySlug;
}

function parseRobots(s: string | null | undefined): Metadata["robots"] | undefined {
  const raw = (s ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  const parts = raw.split(",").map((x) => x.trim());
  const index = parts.includes("noindex")
    ? false
    : parts.includes("index")
      ? true
      : undefined;
  const follow = parts.includes("nofollow")
    ? false
    : parts.includes("follow")
      ? true
      : undefined;
  return { index, follow };
}

export async function generateMetadata({ params, searchParams }: EventPublicPageProps): Promise<Metadata> {
  const { city, slugOrId } = await params;
  const sp = (await searchParams) ?? {};
  const fromDb = await loadPublicActivityForCityPage(city, slugOrId);
  if (fromDb?._redirectToSlug) {
    permanentRedirect(`/${city}/events/${fromDb._redirectToSlug}${searchParamsToSuffix(sp)}`);
  }
  if (!fromDb) {
    const canonicalPath = await resolveCanonicalEventPublicPathBySlugOrId(slugOrId);
    if (canonicalPath && canonicalPath !== `/${city}/events/${slugOrId}`) {
      permanentRedirect(`${canonicalPath}${searchParamsToSuffix(sp)}`);
    }
  }

  if (!fromDb) return {};

  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
  const canonical =
    fromDb.seoCanonicalUrl?.trim() || (fromDb.slug ? `${publicBase}/${city}/events/${fromDb.slug}` : null);

  const title = fromDb.seoTitle?.trim() || `${fromDb.title} в ${cityLabel(city)} — mamaGo`;
  const description =
    fromDb.seoDescription?.trim() || fromDb.shortDesc || `Событие для детей и родителей в ${cityLabel(city)}.`;

  const ogTitle = fromDb.seoOgTitle?.trim() || title;
  const ogDescription = fromDb.seoOgDescription?.trim() || description;
  const ogImage = fromDb.seoOgImage?.trim() || fromDb.coverImageUrl || undefined;

  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    robots: parseRobots(fromDb.seoRobots) ?? { index: true, follow: true },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonical ?? undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function CityEventPublicPage({ params, searchParams }: EventPublicPageProps) {
  const { city, slugOrId } = await params;
  const sp = (await searchParams) ?? {};

  const fromDb = await loadPublicActivityForCityPage(city, slugOrId);
  if (fromDb) {
    if (fromDb._redirectToSlug) {
      permanentRedirect(`/${city}/events/${fromDb._redirectToSlug}${searchParamsToSuffix(sp)}`);
    }

    const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
    const jsonLd =
      fromDb.seoJsonLdOverride && typeof fromDb.seoJsonLdOverride === "object"
        ? (fromDb.seoJsonLdOverride as Record<string, unknown>)
        : buildEventJsonLd({ activity: fromDb, citySlug: city, publicBase });

    const user = await getCurrentUser();
    const ownerEditHref =
      user?.id && fromDb.ownerUserId === user.id
        ? editorEventEditHref(fromDb.id)
        : undefined;

    const previewBannerLabel =
      fromDb.status === ContentStatus.PENDING_UPDATE
        ? "Изменения на проверке"
        : undefined;

    const data = buildEventPageDataFromPrismaActivity(fromDb, {
      citySlug: city,
      ownerEditHref,
      previewBannerLabel,
    });
    return (
      <>
        <AnalyticsDetailBeacon
          entityType="EVENT"
          entityId={fromDb.id}
          vertical="CITY"
          cityId={fromDb.cityId}
          citySlug={city}
        />
        <script
          type="application/ld+json"
           
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <EventPageView data={data} />
      </>
    );
  }

  const canonicalPath = await resolveCanonicalEventPublicPathBySlugOrId(slugOrId);
  if (canonicalPath && canonicalPath !== `/${city}/events/${slugOrId}`) {
    permanentRedirect(`${canonicalPath}${searchParamsToSuffix(sp)}`);
  }

  const activity = city === "minsk" ? MINSK_ACTIVITIES.find((a) => a.id === slugOrId) : undefined;
  if (!activity) {
    return (
      <Container className="pt-20 text-center">
        <h1 className="text-2xl font-bold">Событие не найдено</h1>
        <Link href={`/${city}`} className="mt-4 block text-primary hover:underline">
          На главную
        </Link>
      </Container>
    );
  }

  const data = attachSimilarEvents(buildEventPageData(activity, city), MINSK_ACTIVITIES, city, 4);
  return <EventPageView key={activity.id} data={data} />;
}
