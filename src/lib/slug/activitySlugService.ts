/**
 * Activity/Event slug service
 *
 * Principles:
 * - Slug is auto-assigned ONCE when title becomes meaningful (first fill)
 * - Slug NEVER changes automatically afterwards
 * - Slug can be changed only manually via SEO editor (uses updateActivitySlug)
 * - Old slugs are stored in history and must 301 to current slug
 */

import { prisma } from "@/lib/prisma";
import { slugifyRu } from "@/lib/slugify";
import { ensureUniqueSlug } from "@/lib/slug/ensureUniqueSlug";
import { createActivitySlugHistoryIgnoreDuplicate } from "@/lib/slug/slugHistoryDedupe";
import { syncActivityCanonical } from "@/lib/seo/syncEntityCanonical";

async function isSlugAvailable(slug: string, cityId: string | null | undefined, excludeActivityId?: string) {
  const existing = await prisma.activity.findFirst({
    where: { slug, ...(cityId ? { cityId } : {}) },
    select: { id: true },
  });
  if (existing && existing.id !== excludeActivityId) return false;

  const history = await prisma.activitySlugHistory.findFirst({
    where: { slug, ...(cityId ? { cityId } : {}) },
    select: { activityId: true },
  });
  if (history && history.activityId !== excludeActivityId) return false;

  return true;
}

export async function generateActivitySlugFromTitle(
  title: string,
  cityId: string | null | undefined,
  excludeActivityId?: string,
) {
  const base = slugifyRu((title || "event").trim(), "event");
  return ensureUniqueSlug({
    base,
    isAvailable: (slug) => isSlugAvailable(slug, cityId, excludeActivityId),
  });
}

/**
 * Assign slug when title is first filled (idempotent).
 * If slug already exists — does nothing.
 */
export async function assignActivitySlugIfMissing(activityId: string, title: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, slug: true, cityId: true },
  });
  if (!activity) throw new Error(`Activity not found: ${activityId}`);
  if (activity.slug) return activity.slug;

  const slug = await generateActivitySlugFromTitle(title, activity.cityId, activityId);
  await prisma.$transaction(async (tx) => {
    await createActivitySlugHistoryIgnoreDuplicate(tx, activityId, activityId, activity.cityId);
    await tx.activity.update({
      where: { id: activityId },
      data: {
        slug,
        slugUpdatedAt: new Date(),
      },
      select: { id: true },
    });
  });
  await syncActivityCanonical(activityId);
  return slug;
}

/**
 * Update slug manually and store previous slug in history.
 */
export async function updateActivitySlug(activityId: string, newSlugRaw: string) {
  const newSlug = slugifyRu(newSlugRaw);
  let finalSlug = newSlug;
  await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.findUnique({
      where: { id: activityId },
      select: { slug: true, cityId: true },
    });
    if (!activity) throw new Error(`Activity not found: ${activityId}`);

    if (activity.slug === newSlug) return;

    if (!activity.slug) {
      await createActivitySlugHistoryIgnoreDuplicate(tx, activityId, activityId, activity.cityId);
    }

    // ensure uniqueness across current + history
    const base = newSlug;
    let candidate = base;
    let i = 2;

    while (true) {
      const conflict = await tx.activity.findFirst({
        where: { slug: candidate, ...(activity.cityId ? { cityId: activity.cityId } : {}) },
        select: { id: true },
      });
      const hist = await tx.activitySlugHistory.findFirst({
        where: { slug: candidate, ...(activity.cityId ? { cityId: activity.cityId } : {}) },
        select: { activityId: true },
      });
      const ok =
        (!conflict || conflict.id === activityId) &&
        (!hist || hist.activityId === activityId);
      if (ok) break;
      candidate = `${base}-${i}`;
      i++;
      if (i > 200) throw new Error(`Could not set unique activity slug: ${base}`);
    }

    finalSlug = candidate;

    if (activity.slug) {
      await createActivitySlugHistoryIgnoreDuplicate(tx, activityId, activity.slug, activity.cityId);
    }

    await tx.activity.update({
      where: { id: activityId },
      data: { slug: finalSlug, slugUpdatedAt: new Date() },
    });
  });

  await syncActivityCanonical(activityId);
  return finalSlug;
}

/**
 * Find activity by current slug or old slug history.
 */
export async function findActivityBySlug(slug: string): Promise<{
  activityId: string;
  isRedirect: boolean;
} | null> {
  const current = await prisma.activity.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (current) return { activityId: current.id, isRedirect: false };

  const hist = await prisma.activitySlugHistory.findFirst({
    where: { slug },
    select: { activityId: true },
  });
  if (hist) return { activityId: hist.activityId, isRedirect: true };

  return null;
}
