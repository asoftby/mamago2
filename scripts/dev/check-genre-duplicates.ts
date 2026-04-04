/**
 * Проверка дублей жанров внутри одной категории (name или slug).
 * Одинаковые slug/name в разных категориях — не ошибка.
 *
 * Usage: pnpm exec tsx scripts/dev/check-genre-duplicates.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.genre.findMany({
    select: { id: true, categoryId: true, slug: true, name: true },
  });

  const byCatSlug = new Map<string, string[]>();
  const byCatName = new Map<string, string[]>();

  for (const r of rows) {
    const ks = `${r.categoryId}\t${r.slug}`;
    const kn = `${r.categoryId}\t${r.name}`;
    if (!byCatSlug.has(ks)) byCatSlug.set(ks, []);
    if (!byCatName.has(kn)) byCatName.set(kn, []);
    byCatSlug.get(ks)!.push(r.id);
    byCatName.get(kn)!.push(r.id);
  }

  let bad = false;
  for (const [key, ids] of byCatSlug) {
    if (ids.length > 1) {
      bad = true;
      console.error(`Duplicate slug in category: ${key} → ids: ${ids.join(", ")}`);
    }
  }
  for (const [key, ids] of byCatName) {
    if (ids.length > 1) {
      bad = true;
      console.error(`Duplicate name in category: ${key} → ids: ${ids.join(", ")}`);
    }
  }

  if (!bad) {
    console.log("OK: no duplicate (categoryId, slug) or (categoryId, name) in DB.");
  } else {
    console.error("\nFix data before relying on uniqueness checks.");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
