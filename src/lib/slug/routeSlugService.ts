/**
 * Route slug service
 *
 * Principles:
 * - Slug is assigned on create (and stays stable)
 * - Slug never changes automatically when title changes
 * - Manual slug change via SEO editor stores old slug in history
 */

import { prisma } from "@/lib/prisma";
import { slugifyRu } from "@/lib/slugify";
import { ensureUniqueSlug } from "@/lib/slug/ensureUniqueSlug";

async function isSlugAvailable(slug: string, excludeRouteId?: string) {
  const existing = await prisma.route.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing && existing.id !== excludeRouteId) return false;

  const history = await prisma.routeSlugHistory.findUnique({
    where: { slug },
    select: { routeId: true },
  });
  if (history && history.routeId !== excludeRouteId) return false;

  return true;
}

export async function generateRouteSlugFromTitle(title: string, excludeRouteId?: string) {
  const base = slugifyRu(title || "route");
  return ensureUniqueSlug({
    base,
    isAvailable: (s) => isSlugAvailable(s, excludeRouteId),
  });
}

export async function updateRouteSlug(routeId: string, newSlugRaw: string) {
  const newSlug = slugifyRu(newSlugRaw);
  await prisma.$transaction(async (tx) => {
    const route = await tx.route.findUnique({
      where: { id: routeId },
      select: { slug: true },
    });
    if (!route) throw new Error(`Route not found: ${routeId}`);
    if (route.slug === newSlug) return;

    const finalSlug = await ensureUniqueSlug({
      base: newSlug,
      isAvailable: async (s) => {
        const conflict = await tx.route.findUnique({ where: { slug: s }, select: { id: true } });
        const hist = await tx.routeSlugHistory.findUnique({ where: { slug: s }, select: { routeId: true } });
        return (!conflict || conflict.id === routeId) && (!hist || hist.routeId === routeId);
      },
    });

    await tx.routeSlugHistory.create({ data: { routeId, slug: route.slug } });
    await tx.route.update({
      where: { id: routeId },
      data: { slug: finalSlug, slugUpdatedAt: new Date() },
    });
  });
}

export async function findRouteBySlug(slug: string): Promise<{ routeId: string; isRedirect: boolean } | null> {
  const current = await prisma.route.findUnique({ where: { slug }, select: { id: true } });
  if (current) return { routeId: current.id, isRedirect: false };

  const hist = await prisma.routeSlugHistory.findUnique({ where: { slug }, select: { routeId: true } });
  if (hist) return { routeId: hist.routeId, isRedirect: true };

  return null;
}

