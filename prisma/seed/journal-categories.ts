/** Additional journal categories. Existing categories and assignments are never changed. */
import type { PrismaClient } from "@prisma/client";

export const JOURNAL_EXTRA_CATEGORIES = [
  {
    "slug": "semya-i-roditelstvo",
    "nameRu": "Семья и родительство",
    "nameEn": "Family and Parenting",
    "sortOrder": 100
  },
  {
    "slug": "zanyatiya-i-razvitie",
    "nameRu": "Занятия и развитие",
    "nameEn": "Classes and Development",
    "sortOrder": 110
  },
  {
    "slug": "prazdniki",
    "nameRu": "Праздники",
    "nameEn": "Celebrations",
    "sortOrder": 120
  },
  {
    "slug": "mesta-i-zavedeniya",
    "nameRu": "Места и заведения",
    "nameEn": "Places and Venues",
    "sortOrder": 130
  },
  {
    "slug": "dlya-roditeley",
    "nameRu": "Для родителей",
    "nameEn": "For Parents",
    "sortOrder": 140
  },
  {
    "slug": "doma-s-detmi",
    "nameRu": "Дома с детьми",
    "nameEn": "At Home with Kids",
    "sortOrder": 150
  }
] as const;

export async function seedJournalCategories(prisma: PrismaClient) {
  const existing = await prisma.eventCategory.findMany({
    where: { publicationType: "ARTICLE", parentId: null },
    select: { slug: true, nameRu: true },
  });
  const knownSlugs = new Set(existing.map(category => category.slug));
  const knownNames = new Set(existing.map(category => category.nameRu.trim().toLocaleLowerCase("ru")));
  const missing = JOURNAL_EXTRA_CATEGORIES.filter(category =>
    !knownSlugs.has(category.slug) && !knownNames.has(category.nameRu.toLocaleLowerCase("ru"))
  );
  for (const category of missing) {
    await prisma.eventCategory.upsert({
      where: { publicationType_slug: { publicationType: "ARTICLE", slug: category.slug } },
      update: {},
      create: { ...category, publicationType: "ARTICLE", parentId: null, isActive: true },
    });
  }
  console.log(`  → Journal Categories: ${missing.length} new, ${existing.length} existing preserved`);
}
