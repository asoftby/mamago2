import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";
import type { EventStep1Taxonomies, PublicGenreOption } from "@/components/business/wizard/event/steps/step1Taxonomies";
import { getGenresByCategory } from "@/lib/taxonomy/getGenresByCategory";

export const EVENT_STEP1_CATEGORIES_TAG = "event-step1-categories";
export const eventStep1GenresTag = (categoryId: string) => `event-step1-genres:${categoryId}`;

const getCachedEventCategories = unstable_cache(
  async () => {
    const rows = await prisma.eventCategory.findMany({
      where: { isActive: true, publicationType: "EVENT" },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        nameRu: true,
        slug: true,
        icon: true,
        parentId: true,
        sortOrder: true,
        supportsProgram: true,
        selectableInProgram: true,
        options: {
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { value: "asc" }],
          select: {
            id: true,
            label: true,
            value: true,
            order: true,
            isActive: true,
          },
        },
      },
    });

    const roots = rows.filter((r) => r.parentId == null);
    const childrenByParent = new Map<string, typeof rows>();
    for (const r of rows) {
      if (!r.parentId) continue;
      const list = childrenByParent.get(r.parentId) ?? [];
      list.push(r);
      childrenByParent.set(r.parentId, list);
    }

    return roots.map((root) => ({
      ...root,
      children: (childrenByParent.get(root.id) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
      ),
    }));
  },
  ["admin-event-categories-v1"],
  { revalidate: 3600, tags: [EVENT_STEP1_CATEGORIES_TAG] },
);

const getCachedAgeOptions = unstable_cache(
  async () => {
    const def = await prisma.signalDefinition.findFirst({
      where: { slug: "age", isActive: true },
      include: {
        options: {
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { value: "asc" }],
        },
      },
    });
    return (def?.options ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      value: o.value,
      order: o.order,
      active: o.isActive,
    }));
  },
  ["admin-event-age-options-v1"],
  { revalidate: 3600 },
);

const getCachedInterestOptions = unstable_cache(
  async () => {
    const def = await prisma.signalDefinition.findFirst({
      where: { slug: "interests", isActive: true },
      include: {
        options: {
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { value: "asc" }],
        },
      },
    });
    return (def?.options ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      value: o.value,
      order: o.order,
      active: o.isActive,
    }));
  },
  ["admin-event-interest-options-v1"],
  { revalidate: 3600 },
);

async function getCachedGenresForCategory(categoryId: string): Promise<PublicGenreOption[]> {
  return unstable_cache(
    async () => {
      const rows = await getGenresByCategory(categoryId);
      return rows.map((r) => ({
        id: r.id,
        title: r.name,
        slug: r.slug,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
      }));
    },
    [`admin-event-genres-${categoryId}`],
    { revalidate: 3600, tags: [eventStep1GenresTag(categoryId)] },
  )();
}

export async function getEventStep1Taxonomies(input?: {
  selectedCategoryId?: string | null;
}): Promise<EventStep1Taxonomies> {
  const [categories, ageOptions, interestOptions] = await Promise.all([
    getCachedEventCategories(),
    getCachedAgeOptions(),
    getCachedInterestOptions(),
  ]);

  const genresByCategoryId: Record<string, PublicGenreOption[]> = {};
  const selectedCategoryId = input?.selectedCategoryId?.trim();
  if (selectedCategoryId) {
    genresByCategoryId[selectedCategoryId] = await getCachedGenresForCategory(selectedCategoryId);
  }

  return {
    categories,
    ageOptions,
    interestOptions,
    genresByCategoryId,
  };
}

export type ActivityFormData = {
  activity: {
    id: string;
    title: string;
    eventCategoryId: string | null;
    cityId: string | null;
    status: string;
  } | null;
  taxonomies: EventStep1Taxonomies;
};

export async function getActivityFormData(activityId: string): Promise<ActivityFormData> {
  const [activity, taxonomies] = await Promise.all([
    prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        title: true,
        eventCategoryId: true,
        cityId: true,
        status: true,
      },
    }),
    getEventStep1Taxonomies(),
  ]);

  return {
    activity: activity
      ? {
          ...activity,
          status: String(activity.status),
        }
      : null,
    taxonomies,
  };
}
