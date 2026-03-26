import Link from "next/link";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { EventPageView } from "@/components/event-page";
import { attachSimilarEvents, buildEventPageData } from "@/lib/event/buildEventPageData";
import { MINSK_ACTIVITIES } from "@/mocks/activities.minsk";
import { loadPublicActivityForCityPage } from "@/lib/event/loadPublicActivityForCityPage";
import { buildEventPageDataFromPrismaActivity } from "@/lib/event/buildEventPageDataFromPrisma";
import { buildEventJsonLd } from "@/lib/seo/schema/buildEventJsonLd";

interface ActivityPageProps {
  params: Promise<{ city: string; slugOrId: string }>;
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

function isLegacyNumericId(v: string) {
  return /^\d+$/.test(v);
}

export async function generateMetadata({ params }: ActivityPageProps): Promise<Metadata> {
  const { city, slugOrId } = await params;
  const fromDb = await loadPublicActivityForCityPage(city, slugOrId);
  if (fromDb?._redirectToSlug) {
    permanentRedirect(`/${city}/activity/${fromDb._redirectToSlug}`);
  }

  // Legacy numeric route keeps redirect-only behavior.
  if (isLegacyNumericId(slugOrId)) return {};

  if (!fromDb) return {};

  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
  const canonical =
    fromDb.seoCanonicalUrl?.trim() || (fromDb.slug ? `${publicBase}/${city}/activity/${fromDb.slug}` : null);

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

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { city, slugOrId } = await params;

  const fromDb = await loadPublicActivityForCityPage(city, slugOrId);
  if (fromDb) {
    if (fromDb._redirectToSlug) {
      permanentRedirect(`/${city}/activity/${fromDb._redirectToSlug}`);
    }

    const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
    const jsonLd =
      fromDb.seoJsonLdOverride && typeof fromDb.seoJsonLdOverride === "object"
        ? (fromDb.seoJsonLdOverride as Record<string, unknown>)
        : buildEventJsonLd({ activity: fromDb, citySlug: city, publicBase });

    const data = buildEventPageDataFromPrismaActivity(fromDb, { citySlug: city });
    return (
      <>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <EventPageView data={data} />
      </>
    );
  }

  // Keep old /activity/:id behavior for numeric mock IDs: redirect away.
  if (isLegacyNumericId(slugOrId)) {
    permanentRedirect(`/${city}`);
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

