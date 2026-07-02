import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import Link from "next/link";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { EventPageView } from "@/components/event-page";
import { loadPublicActivityForCityPage } from "@/lib/event/loadPublicActivityForCityPage";
import { ContentStatus } from "@prisma/client";
import { buildEventPageDataFromPrismaActivity } from "@/lib/event/buildEventPageDataFromPrisma";
import { getCurrentUser } from "@/lib/auth/server";
import { editorEventEditHref } from "@/lib/content-editor/types";
import { buildEventJsonLd } from "@/lib/seo/schema/buildEventJsonLd";
import { buildBreadcrumbJsonLd } from "@/lib/seo/schema/buildBreadcrumbJsonLd";
import { buildFaqJsonLd } from "@/lib/seo/schema/buildFaqJsonLd";
import { JsonLd } from "@/components/seo/JsonLd";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { resolveCanonicalEventPublicPathBySlugOrId } from "@/lib/business/resolveCanonicalEventPublicPath";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { fetchReelsThumbnail } from "@/lib/instagram/fetchReelsThumbnail";
import { tryResolvePublicationForCta } from "@/server/services/direct/directThread.service";
import { PublicationType } from "@prisma/client";

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

  const publicBase = getCanonicalPublicAppUrl();
  const canonical =
    fromDb.seoCanonicalUrl?.trim() || (fromDb.slug ? `${publicBase}/${city}/events/${fromDb.slug}` : null);

  const title = fromDb.seoTitle?.trim() || `${fromDb.title} в ${cityLabel(city)} — mamaGo`;
  const description =
    fromDb.seoDescription?.trim() || fromDb.shortDesc || `Событие для детей и родителей в ${cityLabel(city)}.`;

  return buildOgMeta({
    title,
    description,
    image: fromDb.seoOgImage?.trim() || fromDb.coverImageUrl,
    url: canonical ?? `${publicBase}/${city}/events/${fromDb.slug ?? fromDb.id}`,
    robots: parseRobots(fromDb.seoRobots) ?? { index: true, follow: true },
  });}

export default async function CityEventPublicPage({ params, searchParams }: EventPublicPageProps) {
  const { city, slugOrId } = await params;
  const sp = (await searchParams) ?? {};

  const fromDb = await loadPublicActivityForCityPage(city, slugOrId);
  if (fromDb) {
    if (fromDb._redirectToSlug) {
      permanentRedirect(`/${city}/events/${fromDb._redirectToSlug}${searchParamsToSuffix(sp)}`);
    }

    const publicBase = getCanonicalPublicAppUrl();
    const canonicalUrl =
      fromDb.seoCanonicalUrl?.trim() ||
      `${publicBase}/${city}/events/${fromDb.slug ?? fromDb.id}`;
    const locationName =
      fromDb.venue?.place?.title ||
      fromDb.venue?.title ||
      fromDb.place?.title ||
      undefined;
    const locationAddress =
      fromDb.venue?.place?.formattedAddr ||
      fromDb.venue?.place?.customAddress ||
      fromDb.venue?.addressLine ||
      fromDb.place?.formattedAddr ||
      fromDb.place?.customAddress ||
      undefined;
    const jsonLd =
      fromDb.seoJsonLdOverride && typeof fromDb.seoJsonLdOverride === "object"
        ? (fromDb.seoJsonLdOverride as Record<string, unknown>)
        : buildEventJsonLd({
            canonicalUrl,
            title: fromDb.title,
            description: fromDb.shortDesc,
            image: fromDb.seoOgImage?.trim() || fromDb.coverImageUrl,
            sessions: fromDb.sessions,
            format: fromDb.format,
            location:
              locationName || locationAddress
                ? {
                    name: locationName,
                    address: locationAddress,
                  }
                : undefined,
            publicBaseUrl: publicBase,
          });
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
      [
        { name: "Главная", path: "/" },
        { name: city, path: `/${city}` },
        { name: "Афиша", path: `/${city}/events` },
        { name: fromDb.title, path: `/${city}/events/${fromDb.slug ?? fromDb.id}` },
      ],
      publicBase,
    );

    const user = await getCurrentUser();
    const ownerEditHref =
      user?.id && fromDb.ownerUserId === user.id
        ? editorEventEditHref(fromDb.id)
        : undefined;

    const previewBannerLabel =
      fromDb.status === ContentStatus.PENDING_UPDATE
        ? "Изменения на проверке"
        : undefined;

    // Try to get the actual Reels thumbnail (og:image from the Reel page).
    // Cached 24 h by Next.js fetch cache; falls back to event poster on error.
    const rawReelsUrl =
      fromDb.scheduleJson &&
      typeof fromDb.scheduleJson === "object" &&
      "reelsUrl" in fromDb.scheduleJson &&
      typeof (fromDb.scheduleJson as Record<string, unknown>).reelsUrl === "string"
        ? ((fromDb.scheduleJson as Record<string, unknown>).reelsUrl as string).trim()
        : null;
    const reelsThumbnailUrl = rawReelsUrl
      ? await fetchReelsThumbnail(rawReelsUrl)
      : null;

    const data = buildEventPageDataFromPrismaActivity(fromDb, {
      citySlug: city,
      ownerEditHref,
      previewBannerLabel,
      reelsThumbnailUrl: reelsThumbnailUrl ?? undefined,
    });
    const faqJsonLd = buildFaqJsonLd(data.faqItems);

    // Direct CTA — omitted when the event has no resolvable owning Business (rule 5).
    const directPublication = await tryResolvePublicationForCta({
      publicationType: PublicationType.EVENT,
      activityId: fromDb.id,
    });
    const directCta = directPublication
      ? {
          activityId: fromDb.id,
          publicationTitle: fromDb.title,
          brandName: fromDb.venue?.place?.title || fromDb.place?.title || directPublication.business.name,
        }
      : undefined;

    return (
      <>
        <AnalyticsDetailBeacon
          entityType="EVENT"
          entityId={fromDb.id}
          vertical="CITY"
          cityId={fromDb.cityId}
          citySlug={city}
        />
        <JsonLd
          data={[jsonLd, breadcrumbJsonLd, faqJsonLd].filter(Boolean) as Record<string, unknown>[]}
        />
        <EventPageView data={data} direct={directCta} />
      </>
    );
  }

  const canonicalPath = await resolveCanonicalEventPublicPathBySlugOrId(slugOrId);
  if (canonicalPath && canonicalPath !== `/${city}/events/${slugOrId}`) {
    permanentRedirect(`${canonicalPath}${searchParamsToSuffix(sp)}`);
  }

  return (
    <Container className="pt-20 text-center">
      <h1 className="text-2xl font-bold">Событие не найдено</h1>
      <Link href={`/${city}`} className="mt-4 block text-primary hover:underline">
        На главную
      </Link>
    </Container>
  );
}
