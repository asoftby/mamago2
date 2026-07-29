/**
 * /{city}/places/[slug] — legacy/alias route.
 *
 * Place has no city-scoped canonical (unlike Offer/Article/Event) — the one
 * true canonical is always `/places/{slug}` (resolvePlaceCanonicalUrl).
 * Previously this route re-exported `places/[slug]/page.tsx` directly,
 * which never reads its `city` param at all — meaning it rendered an
 * identical HTTP 200 for ANY city segment (correct, wrong, or nonsense),
 * a wrong-city indexable duplicate for every published Place.
 *
 * Always 301-redirects to the real canonical instead. Resolves legacy
 * id / slug-history itself so the redirect is a single hop, not a chain
 * through `/places/[slug]`'s own legacy-id/slug-history redirect.
 */
import { notFound, permanentRedirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { findPlaceBySlug } from "@/lib/slug/placeSlugService";

interface CityPlacePageProps {
  params: Promise<{ city: string; slug: string }>;
}

export default async function CityPlaceRedirectPage({ params }: CityPlacePageProps) {
  const { slug } = await params;
  const isLegacyId = slug.length > 20 && !slug.includes("-");

  const placeId = isLegacyId
    ? (await prisma.place.findUnique({ where: { id: slug }, select: { id: true } }))?.id
    : (await findPlaceBySlug(slug))?.placeId;

  if (!placeId) notFound();

  const place = await prisma.place.findUnique({ where: { id: placeId }, select: { slug: true, id: true } });
  if (!place) notFound();

  permanentRedirect(`/places/${place.slug ?? place.id}`);
}
