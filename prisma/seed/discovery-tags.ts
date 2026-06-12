/**
 * prisma/seed/discovery-tags.ts
 *
 * Seed 6 initial global Discovery Tags for use across all publication wizards
 * (News, Article, Collection, Breaking News).
 *
 * These tags are available city-scoped via `/[city]/tags/[tagSlug]` routes
 * and appear in publication management UI for tagging content.
 */

import { PrismaClient } from "@prisma/client";

interface DiscoveryTagSeed {
  slug: string;
  title: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  sortOrder: number;
}

const DISCOVERY_TAGS: DiscoveryTagSeed[] = [
  {
    slug: "zhivotnye",
    title: "Животные",
    description: "Всё о животных, домашних питомцах и дикой природе",
    seoTitle: "Животные | MamaGo",
    seoDescription:
      "Статьи и события про животных, домашних питомцев и их воспитание",
    sortOrder: 1,
  },
  {
    slug: "krasota-i-stil",
    title: "Красота и стиль",
    description: "Советы по красоте, моде и личному стилю",
    seoTitle: "Красота и стиль | MamaGo",
    seoDescription: "Тренды красоты, моды и стилистических решений для всей семьи",
    sortOrder: 2,
  },
  {
    slug: "kultura-i-iskusstvo",
    title: "Культура и искусство",
    description: "События культуры, выставки, театр и творчество",
    seoTitle: "Культура и искусство | MamaGo",
    seoDescription: "Выставки, театр, музеи и культурные события в городе",
    sortOrder: 3,
  },
  {
    slug: "novye-mesta",
    title: "Новые места",
    description: "Новые открывшиеся заведения и локации в городе",
    seoTitle: "Новые места | MamaGo",
    seoDescription: "Обзоры новых кафе, ресторанов, парков и развлечений",
    sortOrder: 4,
  },
  {
    slug: "ostrye-oshchushcheniya",
    title: "Острые ощущения",
    description: "Экстремальные виды спорта и приключения",
    seoTitle: "Острые ощущения | MamaGo",
    seoDescription: "Экстремальные виды спорта, адреналин и интересные приключения",
    sortOrder: 5,
  },
  {
    slug: "tsirk-i-fokusy",
    title: "Цирк и фокусы",
    description: "Цирк, магия, фокусы и развлечение для детей",
    seoTitle: "Цирк и фокусы | MamaGo",
    seoDescription: "Цирковые шоу, магические представления и развлечения для детей",
    sortOrder: 6,
  },
];

export async function seedDiscoveryTags(prisma: PrismaClient) {
  console.log("  → Discovery Tags");

  for (const tag of DISCOVERY_TAGS) {
    await prisma.discoveryTag.upsert({
      where: { slug: tag.slug },
      update: {
        title: tag.title,
        description: tag.description,
        seoTitle: tag.seoTitle,
        seoDescription: tag.seoDescription,
        sortOrder: tag.sortOrder,
        isActive: true,
      },
      create: {
        slug: tag.slug,
        title: tag.title,
        description: tag.description,
        seoTitle: tag.seoTitle,
        seoDescription: tag.seoDescription,
        sortOrder: tag.sortOrder,
        isActive: true,
      },
    });
  }

  console.log(`    ✓ ${DISCOVERY_TAGS.length} tags seeded`);
}
