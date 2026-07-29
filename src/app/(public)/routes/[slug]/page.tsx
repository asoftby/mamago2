import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import { notFound, permanentRedirect } from "next/navigation";
import { type RouteWithStops } from "@/server/services/route.service";
import { RouteDetailClient } from "./RouteDetailClient";
import prisma from "@/lib/prisma";
import { findRouteBySlug } from "@/lib/slug/routeSlugService";
import { buildRouteJsonLd } from "@/lib/seo/schema/buildRouteJsonLd";
import { buildBreadcrumbJsonLd } from "@/lib/seo/schema/buildBreadcrumbJsonLd";
import { JsonLd } from "@/components/seo/JsonLd";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { resolvePublicRouteCanonicalUrl } from "@/lib/seo/resolveRouteCanonicalUrl";
import { summarizeRouteBudget } from "@/lib/routes/routeBudget";
import { getCurrentUser } from "@/lib/auth/server";
import { canViewRoute } from "@/lib/routes/routeAccess";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

/** Strip region/country suffixes from a Google-formatted address, keeping city + street + house */
function reorderAddress(raw: string, cityName?: string | null): string {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return raw;

  // Remove known noise: anything that looks like "область", "район", country
  const filtered = parts.filter(
    (p) => !/область|район|Беларусь|Belarus|Белоруссия/i.test(p),
  );

  // Find city index
  const city = cityName ?? null;
  const cityIdx = city ? filtered.findIndex((p) => p.toLowerCase() === city.toLowerCase()) : -1;

  if (cityIdx > 0) {
    // Move city to front, keep the rest (street, house) after it, drop duplicates
    const rest = filtered.filter((_, i) => i !== cityIdx);
    return [filtered[cityIdx], ...rest].join(", ");
  }

  // No city reorder needed — just return filtered (region stripped)
  return filtered.join(", ");
}

/** Build a human-readable address line: "Город, улица, дом" */
function buildStopAddress(
  place: RouteWithStops["stops"][0]["place"],
  fallback: string | null,
  detectedCityName?: string | null,
): string {
  if (!place) {
    if (!fallback) return "";
    return reorderAddress(fallback, detectedCityName);
  }
  const parts: string[] = [];
  if (place.city?.name) parts.push(place.city.name);
  if (place.shortAddress) parts.push(place.shortAddress);
  else if (place.formattedAddr) {
    // formattedAddr may contain the city again — strip it
    const stripped = reorderAddress(place.formattedAddr, place.city?.name);
    parts.push(stripped.replace(new RegExp(`^${place.city?.name},?\\s*`, "i"), "").trim());
  }
  return parts.join(", ") || reorderAddress(fallback ?? "", detectedCityName);
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const publicBase = getCanonicalPublicAppUrl();
  const resolved = await findRouteBySlug(slug);
  if (resolved) {
    const db = await prisma.route.findUnique({
      where: { id: resolved.routeId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        visibility: true,
        authorId: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        coverImageUrl: true,
        budgetLevel: true,
        _count: { select: { stops: true } },
        stops: {
          select: {
            photoUrl: true,
            priceType: true,
            priceMin: true,
            priceMax: true,
            priceCurrency: true,
            priceNote: true,
          },
          orderBy: { order: "asc" },
          take: 5,
        },
      },
    });
    if (db && canViewRoute(db, await getCurrentUser())) {
      const budgetSummary = summarizeRouteBudget(db.stops);
      const title = db.seoTitle?.trim() || `${db.title} — маршрут | mamaGo`;
      const description =
        db.seoDescription?.trim() ||
        `${db._count.stops} точки · ${budgetSummary.label}`;
      const image =
        db.coverImageUrl ??
        db.stops.find((s) => s.photoUrl)?.photoUrl;
      const isPubliclyVisible = db.status === "PUBLISHED" && db.visibility === "PUBLIC";
      const canonical = resolvePublicRouteCanonicalUrl({
        seoCanonicalUrl: db.seoCanonicalUrl,
        slug: db.slug,
        id: db.id,
        publicBase,
        status: db.status,
        visibility: db.visibility,
      });
      return {
        ...buildOgMeta({
          title,
          description,
          image,
          url: canonical ?? `${publicBase}/routes/${db.slug}`,
          // UNLISTED («по ссылке») и любые непубличные превью не индексируем.
          ...(!isPubliclyVisible ? { robots: { index: false, follow: false } } : {}),
        }),
        // Never emit a public canonical for a DRAFT/non-public Route —
        // only a PUBLISHED + PUBLIC route gets a canonical link at all.
        ...(canonical ? { alternates: { canonical } } : {}),
      };
    }
  }
  return {};
}

export default async function RouteDetailPage({ params }: Props) {
  const { slug } = await params;

  const resolved = await findRouteBySlug(slug);
  if (resolved) {
    const db = await prisma.route.findUnique({
      where: { id: resolved.routeId },
      select: {
        id: true,
        slug: true,
        title: true,
        ageTags: true,
        budgetLevel: true,
        coverImageUrl: true,
        authorId: true,
        status: true,
        visibility: true,
        cityId: true,
        seoJsonLdOverride: true,
        createdAt: true,
        updatedAt: true,
        city: { select: { id: true, name: true } },
        author: { select: { id: true, email: true, avatarUrl: true } },
        stops: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            lat: true,
            lng: true,
            address: true,
            customTitle: true,
            note: true,
            photoUrl: true,
            detectedCityName: true,
            priceType: true,
            priceMin: true,
            priceMax: true,
            priceCurrency: true,
            priceNote: true,
            place: {
              select: {
                id: true,
                slug: true,
                title: true,
                formattedAddr: true,
                shortAddress: true,
                city: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (db) {
      if (!canViewRoute(db, await getCurrentUser())) {
        notFound();
      }
      const budgetSummary = summarizeRouteBudget(db.stops);
      if (resolved.isRedirect) {
        permanentRedirect(`/routes/${db.slug}`);
      }

      const route = {
        id: db.id,
        slug: db.slug,
        title: db.title,
        ageTags: db.ageTags,
        budgetLevel: db.budgetLevel,
        budgetLabel: budgetSummary.label,
        budgetNote: budgetSummary.note,
        cityName: db.city?.name ?? "Минск",
        coverImageUrl:
          db.coverImageUrl ??
          db.stops.find((s) => s.photoUrl)?.photoUrl ??
          "https://images.unsplash.com/photo-1513884923967-4b182ef1671f?q=80&w=1200",
        authorName: db.author?.email?.split("@")[0] ?? null,
        authorAvatar: db.author?.avatarUrl ?? undefined,
        isEditorial: db.authorId === null,
        stopsCount: db.stops.length,
        createdAt: db.createdAt?.toISOString(),
        updatedAt: db.updatedAt?.toISOString(),
        stops: db.stops.map((s) => ({
          id: s.id,
          order: s.order,
          title: s.place?.title ?? s.customTitle ?? undefined,
          address: buildStopAddress(s.place, s.address, s.detectedCityName),
          note: s.note,
          photoUrl: s.photoUrl ?? "",
          lat: s.lat ?? undefined,
          lng: s.lng ?? undefined,
        })),
      };

      const publicBase = getCanonicalPublicAppUrl();
      const jsonLd =
        db.seoJsonLdOverride && typeof db.seoJsonLdOverride === "object"
          ? (db.seoJsonLdOverride as Record<string, unknown>)
          : buildRouteJsonLd({ route: db, publicBase });
      const routePath = `/routes/${db.slug ?? db.id}`;
      const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [
          { name: "Главная", path: "/" },
          { name: "Маршруты", path: "/routes" },
          { name: db.title, path: routePath },
        ],
        publicBase,
      );

      return (
        <>
          <AnalyticsDetailBeacon
            entityType="ROUTE"
            entityId={db.id}
            vertical="CITY"
            cityId={db.cityId}
          />
          <JsonLd data={[jsonLd, breadcrumbJsonLd].filter(Boolean) as Record<string, unknown>[]} />
          <RouteDetailClient route={route} />
        </>
      );
    }
  }

  notFound();
}
