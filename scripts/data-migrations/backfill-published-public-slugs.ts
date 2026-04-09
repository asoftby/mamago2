/**
 * Backfill slug + canonical sync для уже опубликованных сущностей без slug.
 * Идемпотентно: повторный прогон только обрабатывает строки с пустым slug.
 *
 * Запуск:
 *   pnpm exec tsx scripts/data-migrations/backfill-published-public-slugs.ts
 *   pnpm exec tsx scripts/data-migrations/backfill-published-public-slugs.ts --dry-run
 */
import { ActivityType, ContentStatus, OfferStatus } from "@prisma/client";
import prisma from "../../src/lib/prisma";
import {
  ensurePublishedActivityHasSlug,
  ensurePublishedArticleHasSlug,
  ensurePublishedOfferHasSlug,
  ensurePublishedPlaceHasSlug,
} from "../../src/lib/slug/publishSlugGuards";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const eventIds = (
    await prisma.activity.findMany({
      where: {
        type: ActivityType.EVENT,
        status: ContentStatus.PUBLISHED,
        OR: [{ slug: null }, { slug: "" }],
      },
      select: { id: true },
    })
  ).map((r) => r.id);

  const placeIds = (
    await prisma.place.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        archivedAt: null,
        OR: [{ slug: null }, { slug: "" }],
      },
      select: { id: true },
    })
  ).map((r) => r.id);

  const offerIds = (
    await prisma.offer.findMany({
      where: {
        status: OfferStatus.PUBLISHED,
        OR: [{ slug: null }, { slug: "" }],
      },
      select: { id: true },
    })
  ).map((r) => r.id);

  const articleIds = (
    await prisma.article.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        OR: [{ slug: null }, { slug: "" }],
      },
      select: { id: true },
    })
  ).map((r) => r.id);

  console.log("Backfill published public slugs:", {
    dryRun,
    events: eventIds.length,
    places: placeIds.length,
    offers: offerIds.length,
    articles: articleIds.length,
  });

  if (dryRun) {
    console.log("Dry run — no DB writes.");
    return;
  }

  for (const id of eventIds) {
    await ensurePublishedActivityHasSlug(id);
  }
  for (const id of placeIds) {
    await ensurePublishedPlaceHasSlug(id);
  }
  for (const id of offerIds) {
    await ensurePublishedOfferHasSlug(id);
  }
  for (const id of articleIds) {
    await ensurePublishedArticleHasSlug(id);
  }

  console.log("Done.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
