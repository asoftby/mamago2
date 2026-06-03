import { notFound, permanentRedirect } from "next/navigation";
import { type RouteWithStops } from "@/server/services/route.service";
import { RouteDetailClient } from "./RouteDetailClient";
import prisma from "@/lib/prisma";
import { findRouteBySlug } from "@/lib/slug/routeSlugService";
import { buildRouteJsonLd } from "@/lib/seo/schema/buildRouteJsonLd";
import { AnalyticsDetailBeacon } from "@/components/analytics/AnalyticsDetailBeacon";
import { buildOgMeta } from "@/lib/seo/buildOgMeta";
import { summarizeRouteBudget } from "@/lib/routes/routeBudget";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

/** Build a human-readable address line: "Город, улица, дом" */
function buildStopAddress(
  place: RouteWithStops["stops"][0]["place"],
  fallback: string | null,
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
  const publicBase = process.env.NEXT_PUBLIC_APP_URL || "https://mamago.by";
  const resolved = await findRouteBySlug(slug);
  if (resolved) {
    const db = await prisma.route.findUnique({
      where: { id: resolved.routeId },
      select: {
        title: true,
        slug: true,
        seoTitle: true,
        seoDescription: true,
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
    if (db) {
      const budgetSummary = summarizeRouteBudget(db.stops);
      const title = db.seoTitle?.trim() || `${db.title} — маршрут | mamaGo`;
      const description =
        db.seoDescription?.trim() ||
        `${db._count.stops} точки · ${budgetSummary.label}`;
      const image =
        db.coverImageUrl ??
        db.stops.find((s) => s.photoUrl)?.photoUrl;
      return buildOgMeta({
        title,
        description,
        image,
        url: `${publicBase}/routes/${db.slug ?? slug}`,
      });
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
        cityId: true,
        seoJsonLdOverride: true,
        createdAt: true,
        updatedAt: true,
        city: { select: { id: true, name: true } },
        author: { select: { id: true, email: true, avatarUrl: true } },
        stops: {
          orderBy: { order: "asc" },
          include: {
            place: {
              select: {
                id: true,
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

  notFound();
}
