/**
 * Fix script: исправить ошибочную сущность "Минская область" как City.
 *
 * Что делает:
 * 1. Находит City с slug = "minskaya-oblast" или name содержащим "область"
 * 2. Находит события/места, привязанные к нему
 * 3. Переназначает их на City "Минск" (если адрес содержит "Минск")
 * 4. Деактивирует ошибочный City (isActive = false, isVisibleInCityFilter = false)
 *
 * Запуск: npx tsx src/scripts/fix-minskaya-oblast.ts
 */

import prisma from "@/lib/prisma";

const DRY_RUN = process.env.DRY_RUN !== "false"; // По умолчанию dry run

async function main() {
  console.log(`\n🔧 Fix minskaya-oblast script (DRY_RUN=${DRY_RUN})\n`);

  // ── 1. Найти ошибочные City ────────────────────────────────────────────────
  const badCities = await prisma.city.findMany({
    where: {
      OR: [
        { slug: "minskaya-oblast" },
        { slug: { contains: "oblast" } },
        { slug: { contains: "region" } },
        { name: { contains: "область", mode: "insensitive" } },
        { name: { contains: "region", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true, isActive: true },
  });

  if (badCities.length === 0) {
    console.log("✅ No administrative region cities found. Nothing to fix.");
    return;
  }

  console.log(`Found ${badCities.length} administrative region city/cities:`);
  for (const city of badCities) {
    console.log(`  - "${city.name}" (slug: ${city.slug}, id: ${city.id}, active: ${city.isActive})`);
  }

  // ── 2. Найти Минск ─────────────────────────────────────────────────────────
  const minsk = await prisma.city.findFirst({
    where: { slug: "minsk" },
    select: { id: true, name: true },
  });

  if (!minsk) {
    console.error("❌ City 'minsk' not found in database. Cannot reassign.");
    process.exit(1);
  }

  console.log(`\n✅ Target city: "${minsk.name}" (id: ${minsk.id})\n`);

  // ── 3. Для каждого ошибочного города — переназначить связанные записи ──────
  for (const badCity of badCities) {
    console.log(`\n--- Processing "${badCity.name}" (${badCity.slug}) ---`);

    // Найти активности, привязанные к этому городу
    const activities = await prisma.activity.findMany({
      where: { cityId: badCity.id },
      select: {
        id: true,
        title: true,
        cityId: true,
        place: { select: { formattedAddr: true, shortAddress: true, customAddress: true } },
        venue: { select: { addressLine: true } },
      },
    });

    console.log(`  Activities linked: ${activities.length}`);

    for (const activity of activities) {
      const address = [
        activity.place?.formattedAddr,
        activity.place?.shortAddress,
        activity.place?.customAddress,
        activity.venue?.addressLine,
      ]
        .filter(Boolean)
        .join(" ");

      const looksLikeMinsk =
        /минск|minsk/i.test(address) ||
        /независимости|немига|победы|октябрьская|купаловская/i.test(address);

      const targetCityId = looksLikeMinsk ? minsk.id : null;

      console.log(
        `  Activity "${activity.title}" — address: "${address.slice(0, 60)}" → ${looksLikeMinsk ? `reassign to minsk` : "no address match, skip"}`,
      );

      if (targetCityId && !DRY_RUN) {
        await prisma.activity.update({
          where: { id: activity.id },
          data: { cityId: targetCityId },
        });
      }
    }

    // Найти места, привязанные к этому городу
    const places = await prisma.place.findMany({
      where: { cityId: badCity.id },
      select: {
        id: true,
        title: true,
        formattedAddr: true,
        shortAddress: true,
        customAddress: true,
      },
    });

    console.log(`  Places linked: ${places.length}`);

    for (const place of places) {
      const address = [place.formattedAddr, place.shortAddress, place.customAddress]
        .filter(Boolean)
        .join(" ");

      const looksLikeMinsk = /минск|minsk/i.test(address);

      console.log(
        `  Place "${place.title}" — address: "${address.slice(0, 60)}" → ${looksLikeMinsk ? "reassign to minsk" : "no address match, skip"}`,
      );

      if (looksLikeMinsk && !DRY_RUN) {
        await prisma.place.update({
          where: { id: place.id },
          data: { cityId: minsk.id },
        });
      }
    }

    // ── 4. Деактивировать ошибочный City ──────────────────────────────────────
    console.log(
      `  → ${DRY_RUN ? "[DRY RUN] Would deactivate" : "Deactivating"} city "${badCity.name}"`,
    );

    if (!DRY_RUN) {
      await prisma.city.update({
        where: { id: badCity.id },
        data: {
          isActive: false,
          isVisibleInCityFilter: false,
        },
      });
    }
  }

  console.log(`\n${DRY_RUN ? "🔍 DRY RUN complete. Run with DRY_RUN=false to apply changes." : "✅ Fix complete."}\n`);
}

main()
  .catch((e) => {
    console.error("Script error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
