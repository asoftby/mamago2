/**
 * `/places/[slug]` — legacy/alias route, redirect-only.
 *
 * The canonical Place detail page moved to `/{city}/places/{slug}`
 * (`Place.slug` is only unique per-city — see
 * `docs/migration/seo/final-url-architecture-2026-08-15.md` §2,
 * BACKLOG-115). This route never renders Place content itself: it does a
 * global slug/legacy-id lookup (unavoidable here — the city isn't known
 * yet from this URL alone) purely to find the place's own city and
 * 301-redirect to the real canonical.
 *
 * A Place with no `cityId` cannot be redirected to a city-scoped path at
 * all — that is a genuine data gap (every published Place is expected to
 * have a city), not something this route can silently work around, so it
 * 404s rather than guess a city.
 */
import { notFound, permanentRedirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { findPlaceBySlug } from "@/lib/slug/placeSlugService";
import { buildCityPublicPath } from "@/lib/routing/cityPaths";

interface LegacyPlacePageProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacyPlaceRedirectPage({ params }: LegacyPlacePageProps) {
  const { slug } = await params;
  const isLegacyId = slug.length > 20 && !slug.includes("-");

  const placeId = isLegacyId
    ? (await prisma.place.findUnique({ where: { id: slug }, select: { id: true } }))?.id
    : (await findPlaceBySlug(slug))?.placeId;

  if (!placeId) notFound();

  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { slug: true, id: true, city: { select: { slug: true } } },
  });
  if (!place) notFound();
  if (!place.city?.slug) notFound();

  permanentRedirect(buildCityPublicPath({ citySlug: place.city.slug, type: "place", slug: place.slug ?? place.id }));
}
