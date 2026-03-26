/**
 * Offer slug service
 *
 * Principles:
 * - Slug is auto-assigned ONCE when title becomes meaningful (first fill)
 * - Slug NEVER changes automatically afterwards
 * - Slug can be changed only manually via SEO editor (uses updateOfferSlug)
 * - Old slugs are stored in history and must redirect to current slug
 */

import { prisma } from "@/lib/prisma";
import { slugifyRu } from "@/lib/slugify";
import { ensureUniqueSlug } from "@/lib/slug/ensureUniqueSlug";

async function isSlugAvailable(slug: string, excludeOfferId?: string) {
  const existing = await prisma.offer.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing && existing.id !== excludeOfferId) return false;

  const history = await prisma.offerSlugHistory.findUnique({
    where: { slug },
    select: { offerId: true },
  });
  if (history && history.offerId !== excludeOfferId) return false;

  return true;
}

export async function generateOfferSlugFromTitle(title: string, excludeOfferId?: string) {
  const base = slugifyRu(title || "offer");
  return ensureUniqueSlug({
    base,
    isAvailable: (slug) => isSlugAvailable(slug, excludeOfferId),
  });
}

export async function assignOfferSlugIfMissing(offerId: string, title: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, slug: true },
  });
  if (!offer) throw new Error(`Offer not found: ${offerId}`);
  if (offer.slug) return offer.slug;

  const slug = await generateOfferSlugFromTitle(title, offerId);
  await prisma.offer.update({
    where: { id: offerId },
    data: { slug, slugUpdatedAt: new Date() },
    select: { id: true },
  });
  return slug;
}

export async function updateOfferSlug(offerId: string, newSlugRaw: string) {
  const newSlug = slugifyRu(newSlugRaw);
  await prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findUnique({
      where: { id: offerId },
      select: { slug: true },
    });
    if (!offer) throw new Error(`Offer not found: ${offerId}`);
    if (offer.slug === newSlug) return;

    const base = newSlug;
    let finalSlug = base;
    let i = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const conflict = await tx.offer.findUnique({
        where: { slug: finalSlug },
        select: { id: true },
      });
      const hist = await tx.offerSlugHistory.findUnique({
        where: { slug: finalSlug },
        select: { offerId: true },
      });
      const ok =
        (!conflict || conflict.id === offerId) &&
        (!hist || hist.offerId === offerId);
      if (ok) break;
      finalSlug = `${base}-${i}`;
      i++;
      if (i > 200) throw new Error(`Could not set unique offer slug: ${base}`);
    }

    if (offer.slug) {
      await tx.offerSlugHistory.create({
        data: { offerId, slug: offer.slug },
      });
    }

    await tx.offer.update({
      where: { id: offerId },
      data: { slug: finalSlug, slugUpdatedAt: new Date() },
    });
  });

  return newSlug;
}

export async function findOfferBySlug(slug: string): Promise<{
  offerId: string;
  isRedirect: boolean;
} | null> {
  const current = await prisma.offer.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (current) return { offerId: current.id, isRedirect: false };

  const hist = await prisma.offerSlugHistory.findUnique({
    where: { slug },
    select: { offerId: true },
  });
  if (hist) return { offerId: hist.offerId, isRedirect: true };

  return null;
}

