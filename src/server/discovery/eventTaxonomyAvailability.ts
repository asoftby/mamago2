import type { PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";
import { buildKudaDiscoveryWhere } from "@/server/discovery/kudaDiscoveryFeed";

export type AvailableEventTaxonomyCategory = {
  id: string;
  nameRu: string;
  nameEn: string | null;
  slug: string;
  icon: string | null;
  sortOrder: number;
  genres: Array<{ id: string; nameRu: string; slug: string; sortOrder: number }>;
};

type TaxonomyPrisma = Pick<PrismaClient, "activity" | "eventCategory">;

const taxonomySelect = {
  id: true,
  nameRu: true,
  nameEn: true,
  slug: true,
  icon: true,
  sortOrder: true,
  genres: {
    where: { isActive: true },
    select: { id: true, name: true, slug: true, sortOrder: true },
    orderBy: { sortOrder: "asc" as const },
  },
};

export async function getActiveEventTaxonomy(
  db: Pick<PrismaClient, "eventCategory"> = prisma,
): Promise<AvailableEventTaxonomyCategory[]> {
  const categories = await db.eventCategory.findMany({
    where: { publicationType: "EVENT", isActive: true, parentId: null },
    select: taxonomySelect,
    orderBy: { sortOrder: "asc" },
  });
  return categories.map((category) => ({
    ...category,
    genres: category.genres.map(({ name, ...genre }) => ({ ...genre, nameRu: name })),
  }));
}

export function filterTaxonomyByUsage(
  categories: Array<{
    id: string;
    nameRu: string;
    nameEn: string | null;
    slug: string;
    icon: string | null;
    sortOrder: number;
    genres: Array<{ id: string; name: string; slug: string; sortOrder: number }>;
  }>,
  genreSlugsByCategoryId: ReadonlyMap<string, ReadonlySet<string>>,
): AvailableEventTaxonomyCategory[] {
  return categories.flatMap((category) => {
    const usedGenres = genreSlugsByCategoryId.get(category.id);
    if (!usedGenres) return [];
    return [{
      ...category,
      genres: category.genres
        .filter((genre) => usedGenres.has(genre.slug))
        .map(({ name, ...genre }) => ({ ...genre, nameRu: name })),
    }];
  });
}

export async function getAvailableEventTaxonomy(
  cityId: string,
  citySlug: string,
  db: TaxonomyPrisma = prisma,
): Promise<AvailableEventTaxonomyCategory[]> {
  const { where } = await buildKudaDiscoveryWhere(cityId, citySlug, {
    eventFilters: {
      categorySlugs: [],
      genreSlugs: [],
      dateRange: null,
      free: false,
      priceMax: null,
      districtId: null,
      metroId: null,
      adultOnly: false,
    },
  });
  const usageRows = await db.activity.findMany({
    where,
    select: { eventCategoryId: true, genreSlugs: true },
  });

  const genreSlugsByCategoryId = new Map<string, Set<string>>();
  for (const row of usageRows) {
    if (!row.eventCategoryId) continue;
    const slugs = genreSlugsByCategoryId.get(row.eventCategoryId) ?? new Set<string>();
    row.genreSlugs.forEach((slug) => slugs.add(slug));
    genreSlugsByCategoryId.set(row.eventCategoryId, slugs);
  }
  const categoryIds = [...genreSlugsByCategoryId.keys()];
  if (categoryIds.length === 0) return [];
  const allUsedGenreSlugs = [...new Set([...genreSlugsByCategoryId.values()].flatMap((slugs) => [...slugs]))];

  const categories = await db.eventCategory.findMany({
    where: {
      id: { in: categoryIds },
      publicationType: "EVENT",
      isActive: true,
      parentId: null,
    },
    select: { ...taxonomySelect, genres: { ...taxonomySelect.genres, where: { isActive: true, slug: { in: allUsedGenreSlugs } } } },
    orderBy: { sortOrder: "asc" },
  });
  return filterTaxonomyByUsage(categories, genreSlugsByCategoryId);
}
