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

async function isSlugAvailable(slug: string, excludeActivityId?: string) {
  const existing = await prisma.activity.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing && existing.id !== excludeActivityId) return false;

  const history = await prisma.activitySlugHistory.findUnique({
    where: { slug },
    select: { activityId: true },
  });
  if (history && history.activityId !== excludeActivityId) return false;

  return true;
}

export async function generateActivitySlugFromTitle(
  title: string,
  excludeActivityId?: string,
) {
  const base = slugifyRu(title || "event");
  return ensureUniqueSlug({
    base,
    isAvailable: (slug) => isSlugAvailable(slug, excludeActivityId),
  });
}

/**
 * Assign slug when title is first filled (idempotent).
 * If slug already exists — does nothing.
 */
export async function assignActivitySlugIfMissing(activityId: string, title: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, slug: true },
  });
  if (!activity) throw new Error(`Activity not found: ${activityId}`);
  if (activity.slug) return activity.slug;

  const slug = await generateActivitySlugFromTitle(title, activityId);
  await prisma.activity.update({
    where: { id: activityId },
    data: {
      slug,
      slugUpdatedAt: new Date(),
    },
    select: { id: true },
  });
  return slug;
}

/**
 * Update slug manually and store previous slug in history.
 */
export async function updateActivitySlug(activityId: string, newSlugRaw: string) {
  const newSlug = slugifyRu(newSlugRaw);
  await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.findUnique({
      where: { id: activityId },
      select: { slug: true },
    });
    if (!activity) throw new Error(`Activity not found: ${activityId}`);

    if (activity.slug === newSlug) return;

    // ensure uniqueness across current + history
    const base = newSlug;
    let finalSlug = base;
    let i = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const conflict = await tx.activity.findUnique({
        where: { slug: finalSlug },
        select: { id: true },
      });
      const hist = await tx.activitySlugHistory.findUnique({
        where: { slug: finalSlug },
        select: { activityId: true },
      });
      const ok =
        (!conflict || conflict.id === activityId) &&
        (!hist || hist.activityId === activityId);
      if (ok) break;
      finalSlug = `${base}-${i}`;
      i++;
      if (i > 200) throw new Error(`Could not set unique activity slug: ${base}`);
    }

    if (activity.slug) {
      await tx.activitySlugHistory.create({
        data: { activityId, slug: activity.slug },
      });
    }

    await tx.activity.update({
      where: { id: activityId },
      data: { slug: finalSlug, slugUpdatedAt: new Date() },
    });
  });

  return newSlug;
}

/**
 * Find activity by current slug or old slug history.
 */
export async function findActivityBySlug(slug: string): Promise<{
  activityId: string;
  isRedirect: boolean;
} | null> {
  const current = await prisma.activity.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (current) return { activityId: current.id, isRedirect: false };

  const hist = await prisma.activitySlugHistory.findUnique({
    where: { slug },
    select: { activityId: true },
  });
  if (hist) return { activityId: hist.activityId, isRedirect: true };

  return null;
}

