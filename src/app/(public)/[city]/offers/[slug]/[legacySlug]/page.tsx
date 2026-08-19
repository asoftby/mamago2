/**
 * `/{city}/offers/{section}/{slug}` — legacy/alias route, redirect-only.
 *
 * Directory names here are `[slug]/[legacySlug]` rather than
 * `[section]/[slug]` purely because Next.js requires sibling dynamic
 * segments at the same path depth to share one param name across the
 * whole app — the canonical page now occupies `/{city}/offers/[slug]` at
 * this depth, so this legacy 4-segment route reuses that same `slug`
 * param name for its first segment (still semantically "section" at
 * runtime — the value is never read) and calls its second segment
 * `legacySlug` to avoid ambiguity. Nothing else changes: the canonical
 * Offer detail page moved to `/{city}/offers/{slug}` — the old
 * `{section}` segment (formerly `kind`/`durationType`/`campProgramType`)
 * was dropped from the canonical identity entirely — see
 * `docs/migration/seo/final-url-architecture-2026-08-15.md` §3,
 * BACKLOG-116. The would-be "section" value (this route's `slug` param)
 * is ignored entirely; the redirect target only ever depends on the
 * offer's own real slug and city.
 */
import { notFound, permanentRedirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { findOfferBySlug } from "@/lib/slug/offerSlugService";
import { getOfferPublicPath } from "@/lib/offers/offerPublicUrl";
import { isOfferPubliclyVisible } from "@/lib/offers/offerVisibility";

interface LegacyOfferPageProps {
  params: Promise<{ city: string; slug: string; legacySlug: string }>;
}

export default async function LegacySectionOfferRedirectPage({ params }: LegacyOfferPageProps) {
  const { legacySlug: slug } = await params;

  const resolved = await findOfferBySlug(slug);
  if (!resolved) notFound();

  const offer = await prisma.offer.findUnique({
    where: { id: resolved.offerId },
    select: {
      id: true,
      slug: true,
      status: true,
      archivedAt: true,
      place: {
        select: {
          archivedAt: true,
          ownerBusiness: { select: { operationalStatus: true } },
          city: { select: { slug: true } },
        },
      },
    },
  });
  if (!offer || !isOfferPubliclyVisible(offer)) notFound();
  if (!offer.place?.city?.slug) notFound();

  permanentRedirect(getOfferPublicPath(offer, offer.place.city.slug));
}
