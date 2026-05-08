/**
 * prisma/seed/pages.ts
 * 
 * Seed для начальных системных страниц
 * 
 * Usage: npx tsx prisma/seed/pages.ts
 */

import prisma from "../../src/lib/prisma";
import { PageType, PageStatus, PageVisibility } from "@prisma/client";

const INITIAL_PAGES = [
  {
    slug: "privacy-policy",
    title: "Политика конфиденциальности",
    type: PageType.LEGAL,
    status: PageStatus.DRAFT,
    visibility: PageVisibility.PUBLIC,
    excerpt: "Политика обработки персональных данных mamaGo.by",
    content: `<h2>Политика конфиденциальности</h2>
<p>Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей сервиса mamaGo.by</p>
<p><em>Содержимое будет добавлено позже</em></p>`,
    seoTitle: "Политика конфиденциальности — mamaGo.by",
    seoDescription: "Политика обработки персональных данных пользователей сервиса mamaGo.by",
  },
  {
    slug: "terms",
    title: "Пользовательское соглашение",
    type: PageType.LEGAL,
    status: PageStatus.DRAFT,
    visibility: PageVisibility.PUBLIC,
    excerpt: "Условия использования сервиса mamaGo.by",
    content: `<h2>Пользовательское соглашение</h2>
<p>Настоящее Пользовательское соглашение регулирует отношения между пользователями и сервисом mamaGo.by</p>
<p><em>Содержимое будет добавлено позже</em></p>`,
    seoTitle: "Пользовательское соглашение — mamaGo.by",
    seoDescription: "Условия использования сервиса mamaGo.by",
  },
  {
    slug: "public-offer",
    title: "Публичная оферта",
    type: PageType.LEGAL,
    status: PageStatus.DRAFT,
    visibility: PageVisibility.PUBLIC,
    excerpt: "Договор публичной оферты на оказание услуг",
    content: `<h2>Публичная оферта</h2>
<p>Настоящий договор является публичной офертой на оказание услуг сервиса mamaGo.by</p>
<p><em>Содержимое будет добавлено позже</em></p>`,
    seoTitle: "Публичная оферта — mamaGo.by",
    seoDescription: "Договор публичной оферты на оказание услуг mamaGo.by",
  },
  {
    slug: "advertising",
    title: "Рекламодателям",
    type: PageType.MARKETING,
    status: PageStatus.DRAFT,
    visibility: PageVisibility.PUBLIC,
    excerpt: "Размещение рекламы на mamaGo.by",
    content: `<h2>Рекламодателям</h2>
<p>mamaGo.by — крупнейшая платформа для семейного досуга в Беларуси</p>
<p><em>Содержимое будет добавлено позже</em></p>`,
    seoTitle: "Реклама на mamaGo.by — Рекламодателям",
    seoDescription: "Размещение рекламы на платформе mamaGo.by",
  },
  {
    slug: "for-business",
    title: "Для бизнеса",
    type: PageType.MARKETING,
    status: PageStatus.DRAFT,
    visibility: PageVisibility.PUBLIC,
    excerpt: "Возможности mamaGo Business для организаторов",
    content: `<h2>mamaGo Business</h2>
<p>Привлекайте клиентов и управляйте бизнесом с mamaGo Business</p>
<p><em>Содержимое будет добавлено позже</em></p>`,
    seoTitle: "mamaGo Business — Для организаторов и бизнеса",
    seoDescription: "Возможности mamaGo Business для организаторов детских мероприятий",
  },
];

export async function seedPages() {
  console.log("🌱 Seeding initial pages...");

  for (const pageData of INITIAL_PAGES) {
    // Проверяем, существует ли страница с таким slug
    const existing = await prisma.page.findUnique({
      where: { slug: pageData.slug },
    });

    if (existing) {
      console.log(`  ⏭️  Page "${pageData.slug}" already exists, skipping`);
      continue;
    }

    // Создаем страницу
    await prisma.page.create({
      data: pageData,
    });

    console.log(`  ✅ Created page: ${pageData.title} (${pageData.slug})`);
  }

  console.log("✅ Pages seeding completed");
}

// Для прямого запуска: npx tsx prisma/seed/pages.ts
if (require.main === module) {
  seedPages()
    .catch((e) => {
      console.error("❌ Error seeding pages:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
