import type { ArticleContentPayload } from "@/lib/publications/articleMvp";

export type LegacyEditorialRouteArticleMigrationItem = {
  sourceRecordKey: `wordpress-db:routes:${number}`;
  slug: string;
  expectedStops: number;
  expectedBlocks: number;
};

export const LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE = [
  {
    sourceRecordKey: "wordpress-db:routes:17822",
    slug: "marshrut-po-drozdam-zhivopisno-i-razvlekatelno",
    expectedStops: 6,
    expectedBlocks: 12,
  },
  {
    sourceRecordKey: "wordpress-db:routes:18437",
    slug: "marshrut-kurosovshchina-zoologicheski-ekstremalnaya",
    expectedStops: 4,
    expectedBlocks: 8,
  },
  {
    sourceRecordKey: "wordpress-db:routes:19413",
    slug: "marshrut-majak-minska-krasivo-i-aktivno",
    expectedStops: 5,
    expectedBlocks: 10,
  },
  {
    sourceRecordKey: "wordpress-db:routes:22133",
    slug: "marshrut-narochanskij-zhivopisno-i-peshehodno",
    expectedStops: 11,
    expectedBlocks: 22,
  },
  {
    sourceRecordKey: "wordpress-db:routes:24298",
    slug: "chto-posmotret-turistu-za-2-dnya-v-kobrine-i-breste",
    expectedStops: 6,
    expectedBlocks: 12,
  },
  {
    sourceRecordKey: "wordpress-db:routes:24917",
    slug: "marshrut-malinovka",
    expectedStops: 4,
    expectedBlocks: 8,
  },
  {
    sourceRecordKey: "wordpress-db:routes:25888",
    slug: "marshrut-traktornyj-zavod",
    expectedStops: 5,
    expectedBlocks: 10,
  },
  {
    sourceRecordKey: "wordpress-db:routes:29290",
    slug: "marshrut-braslav-nomad-houses-chto-posmotret-v-braslave",
    expectedStops: 11,
    expectedBlocks: 22,
  },
  {
    sourceRecordKey: "wordpress-db:routes:32543",
    slug: "marshrut-shchorsy",
    expectedStops: 6,
    expectedBlocks: 12,
  },
  {
    sourceRecordKey: "wordpress-db:routes:34581",
    slug: "novogodniy-marshrut",
    expectedStops: 9,
    expectedBlocks: 27,
  },
  {
    sourceRecordKey: "wordpress-db:routes:47932",
    slug: "5-mini-puteshestvij-na-1-den-nedaleko-ot-minska",
    expectedStops: 5,
    expectedBlocks: 10,
  },
  {
    sourceRecordKey: "wordpress-db:routes:48687",
    slug: "marshrut-na-avtodome-zoopark-vodopady-safari-gomel",
    expectedStops: 8,
    expectedBlocks: 16,
  },
  {
    sourceRecordKey: "wordpress-db:routes:51442",
    slug: "marshrut-po-piteru-kulturnaya-programma-na-2-sutok-bez-detej",
    expectedStops: 6,
    expectedBlocks: 12,
  },
] as const satisfies readonly LegacyEditorialRouteArticleMigrationItem[];

export const LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SOURCE_KEY =
  "wordpress-db:routes:46963" as const;
export const LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SLUG = "marshrut-mogilev" as const;
export const LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXPECTED_STOPS = 86;
export const LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CITY_SLUG = "minsk" as const;
export const LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_COUNTRY_ISO = "BY" as const;
export const LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_NAME = "Маршруты" as const;
export const LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_CATEGORY_SLUG = "marshruty" as const;

/**
 * Proven historical RouteStop -> Article image mapping for
 * wordpress-db:routes:34581, in RouteStop presentation order.
 */
export const LEGACY_NOVOGODNIY_ROUTE_MEDIA_IDS = [
  "cmshbwgrt0001ws3jd3gcizc0",
  "cmshbwhbe0005ws3jlp59zm2r",
  "cmshbwhwp0009ws3jeqkapo96",
  "cmshbwifw000dws3jco62q5vr",
  "cmshbwj56000hws3j2xiocrqb",
  "cmshbwjo1000lws3jvmrnxb55",
  "cmshbwk9d000pws3jxcsuf70j",
  "cmshbwkpd000tws3jfkgg99md",
  "cmshbwl7v000xws3jehi3v526",
] as const;

export type LegacyEditorialRouteStopForArticle = {
  order: number;
  customTitle: string;
  note: string;
  mediaId?: string | null;
};

function sourceExternalId(sourceRecordKey: string): string {
  return sourceRecordKey.split(":").at(-1) ?? "unknown";
}

function blockId(sourceRecordKey: string, order: number, kind: "heading" | "text" | "image") {
  return `legacy-route-${sourceExternalId(sourceRecordKey)}-stop-${order}-${kind}`;
}

/**
 * Reconstructs the historically audited Article representation:
 * heading + text for every ordered RouteStop, plus an image immediately
 * after the stop text when that stop has a proven MediaAsset mapping.
 */
export function buildLegacyEditorialRouteArticleContent(
  sourceRecordKey: string,
  stops: readonly LegacyEditorialRouteStopForArticle[],
): ArticleContentPayload {
  const blocks: ArticleContentPayload["blocks"] = [];
  for (const stop of [...stops].sort((a, b) => a.order - b.order)) {
    blocks.push({
      id: blockId(sourceRecordKey, stop.order, "heading"),
      type: "heading",
      level: 2,
      text: stop.customTitle.trim(),
    });
    blocks.push({
      id: blockId(sourceRecordKey, stop.order, "text"),
      type: "text",
      text: stop.note.trim(),
    });
    if (stop.mediaId) {
      blocks.push({
        id: blockId(sourceRecordKey, stop.order, "image"),
        type: "image",
        mediaId: stop.mediaId,
        alt: stop.customTitle.trim(),
      });
    }
  }
  return { version: 1, blocks };
}
