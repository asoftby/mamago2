import { notFound, permanentRedirect } from "next/navigation";
import { MOCK_ROUTES, BUDGET_LABELS } from "@/mocks/routes.mock";
import { formatAgeKeysShort } from "@/lib/config/ages";
import { type RouteWithStops } from "@/server/services/route.service";
import { RouteDetailClient } from "./RouteDetailClient";
import prisma from "@/lib/prisma";
import { findRouteBySlug } from "@/lib/slug/routeSlugService";
import { buildRouteJsonLd } from "@/lib/seo/schema/buildRouteJsonLd";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

/** Build a human-readable address line: "Город, улица, дом" */
function buildStopAddress(
  place: RouteWithStops["stops"][0]["place"],
  fallback: string | null
): string {
  if (!place) return fallback ?? "";
  const parts: string[] = [];
  if (place.city?.name) parts.push(place.city.name);
  if (place.shortAddress) parts.push(place.shortAddress);
  else if (place.formattedAddr) parts.push(place.formattedAddr);
  return parts.join(", ") || fallback || "";
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const resolved = await findRouteBySlug(slug);
  if (resolved) {
    const db = await prisma.route.findUnique({
      where: { id: resolved.routeId },
      select: {
        title: true,
        seoTitle: true,
        seoDescription: true,
        budgetLevel: true,
        _count: { select: { stops: true } },
      },
    });
    if (db) {
      return {
        title: db.seoTitle?.trim() || `${db.title} — маршрут | mamaGo`,
        description:
          db.seoDescription?.trim() ||
          `${db._count.stops} точки · ${BUDGET_LABELS[db.budgetLevel as keyof typeof BUDGET_LABELS] ?? ""}`,
      };
    }
  }
  const mock = MOCK_ROUTES.find((r) => r.slug === slug);
  if (mock) {
    return {
      title: `${mock.title} — маршрут в ${mock.cityName} | mamaGo`,
      description: `${mock.stopsCount} точки · ${BUDGET_LABELS[mock.budgetLevel]} · ${formatAgeKeysShort(mock.ageTags)}`,
    };
  }
  return {};
}

export default async function RouteDetailPage({ params }: Props) {
  const { slug } = await params;

  const resolved = await findRouteBySlug(slug);
  if (resolved) {
    const db = await prisma.route.findUnique({
    where: { id: resolved.routeId },
    include: {
      city: { select: { id: true, name: true } },
      author: { select: { id: true, email: true } },
      stops: {
        orderBy: { order: "asc" },
        include: { place: { select: { id: true, title: true, formattedAddr: true, shortAddress: true, city: { select: { name: true } } } } },
      },
    },
    });
    if (db) {
      if (resolved.isRedirect) {
        permanentRedirect(`/routes/${db.slug}`);
      }

      const route = {
        id: db.id,
        slug: db.slug,
        title: db.title,
        isMockRoute: false as const,
        ageTags: db.ageTags,
        budgetLevel: db.budgetLevel,
        cityName: db.city?.name ?? "Минск",
        coverImageUrl:
          db.coverImageUrl ??
          db.stops.find((s) => s.photoUrl)?.photoUrl ??
          "https://images.unsplash.com/photo-1513884923967-4b182ef1671f?q=80&w=1200",
        authorName: db.author?.email?.split("@")[0] ?? null,
        isEditorial: db.authorId === null,
        stopsCount: db.stops.length,
        stops: db.stops.map((s) => ({
          id: s.id,
          order: s.order,
          title: s.place?.title ?? s.customTitle ?? undefined,
          address: buildStopAddress(s.place, s.address),
          note: s.note,
          photoUrl: s.photoUrl ?? "",
          lat: s.lat ?? undefined,
          lng: s.lng ?? undefined,
        })),
      };

      const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
      const jsonLd =
        db.seoJsonLdOverride && typeof db.seoJsonLdOverride === "object"
          ? (db.seoJsonLdOverride as Record<string, unknown>)
          : buildRouteJsonLd({ route: db, publicBase });

      return (
        <>
          <AnalyticsDetailBeacon
            entityType="ROUTE"
            entityId={db.id}
            vertical="CITY"
            cityId={db.cityId}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <RouteDetailClient route={route} />
        </>
      );
    }
  }

  const mock = MOCK_ROUTES.find((r) => r.slug === slug);
  if (mock) {
    return (
      <>
        <AnalyticsDetailBeacon
          entityType="ROUTE"
          entityId={mock.id}
          vertical="WEEKEND"
          citySlug="minsk"
        />
        <RouteDetailClient route={{ ...mock, isMockRoute: true }} />
      </>
    );
  }

  notFound();
}
