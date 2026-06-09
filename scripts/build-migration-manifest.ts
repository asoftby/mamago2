/**
 * SEO migration manifest: canonical new_url targets and article slug-history redirects.
 * Output: manifest.csv (project root).
 *
 * Run: pnpm build-migration-manifest
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ContentStatus } from "@prisma/client";
import prisma from "../src/lib/prisma";
import {
  buildCityPublicPath,
  buildNationalArticlePath,
  getBaseUrl,
  stripTrailingSlash,
} from "../src/lib/routing/cityPaths";

type ManifestRow = {
  rule_type: string;
  old_url: string;
  new_url: string;
  entity_type: string;
  entity_id: string;
  notes: string;
};

function abs(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getBaseUrl()}${stripTrailingSlash(normalized)}`;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: ManifestRow[]): string {
  const header = ["rule_type", "old_url", "new_url", "entity_type", "entity_id", "notes"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      header.map((key) => csvEscape(row[key as keyof ManifestRow] ?? "")).join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const rows: ManifestRow[] = [];

  const articles = await prisma.article.findMany({
    where: {
      status: ContentStatus.PUBLISHED,
      slug: { not: null },
    },
    select: {
      id: true,
      slug: true,
      geoScope: true,
      city: { select: { slug: true } },
    },
    orderBy: { publishedAt: "desc" },
  });

  for (const article of articles) {
    if (!article.slug) continue;
    const path =
      article.geoScope === "CITY" && article.city?.slug
        ? buildCityPublicPath({
            citySlug: article.city.slug,
            type: "article",
            slug: article.slug,
          })
        : buildNationalArticlePath(article.slug);

    rows.push({
      rule_type: "canonical",
      old_url: "",
      new_url: abs(path),
      entity_type: "article",
      entity_id: article.id,
      notes: "published canonical target",
    });

    // Legacy WordPress journal segment → city blog (Minsk interim).
    if (article.geoScope === "CITY" && article.city?.slug) {
      const legacyJournalPath = stripTrailingSlash(`/journal/${article.slug}`);
      rows.push({
        rule_type: "wp_journal",
        old_url: abs(legacyJournalPath),
        new_url: abs(path),
        entity_type: "article",
        entity_id: article.id,
        notes: "WordPress /journal/{slug} → city blog",
      });
    }
  }

  const history = await prisma.articleSlugHistory.findMany({
    select: {
      id: true,
      slug: true,
      cityId: true,
      articleId: true,
      city: { select: { slug: true } },
      article: {
        select: {
          slug: true,
          geoScope: true,
          city: { select: { slug: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const entry of history) {
    const currentSlug = entry.article.slug?.trim();
    if (!currentSlug || entry.slug === currentSlug) continue;

    const citySlug = entry.city?.slug ?? entry.article.city?.slug;
    const oldPath =
      entry.article.geoScope === "CITY" && citySlug
        ? buildCityPublicPath({ citySlug, type: "article", slug: entry.slug })
        : buildNationalArticlePath(entry.slug);
    const newPath =
      entry.article.geoScope === "CITY" && citySlug
        ? buildCityPublicPath({ citySlug, type: "article", slug: currentSlug })
        : buildNationalArticlePath(currentSlug);

    rows.push({
      rule_type: "slug_history",
      old_url: abs(oldPath),
      new_url: abs(newPath),
      entity_type: "article",
      entity_id: entry.articleId,
      notes: `history row ${entry.id}`,
    });
  }

  const outPath = join(process.cwd(), "manifest.csv");
  writeFileSync(outPath, toCsv(rows), "utf8");
  console.log(`Wrote ${rows.length} rows to ${outPath}`);
}

main()
  .catch((error) => {
    console.error("[build-migration-manifest]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
