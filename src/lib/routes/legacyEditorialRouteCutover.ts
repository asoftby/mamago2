export const LEGACY_EDITORIAL_ROUTE_SLUGS = [
  "marshrut-po-drozdam-zhivopisno-i-razvlekatelno",
  "marshrut-kurosovshchina-zoologicheski-ekstremalnaya",
  "marshrut-majak-minska-krasivo-i-aktivno",
  "marshrut-narochanskij-zhivopisno-i-peshehodno",
  "chto-posmotret-turistu-za-2-dnya-v-kobrine-i-breste",
  "marshrut-malinovka",
  "marshrut-traktornyj-zavod",
  "marshrut-braslav-nomad-houses-chto-posmotret-v-braslave",
  "marshrut-shchorsy",
  "novogodniy-marshrut",
  "5-mini-puteshestvij-na-1-den-nedaleko-ot-minska",
  "marshrut-na-avtodome-zoopark-vodopady-safari-gomel",
  "marshrut-po-piteru-kulturnaya-programma-na-2-sutok-bez-detej",
] as const;

export const LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG = "marshrut-mogilev";
export const LEGACY_EDITORIAL_ROUTE_ARTICLE_CITY_SLUG = "minsk";
export const LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_NAME = "Маршруты";
export const LEGACY_EDITORIAL_ROUTE_ARTICLE_CATEGORY_SLUG = "marshruty";

const LEGACY_EDITORIAL_ROUTE_SLUG_SET = new Set<string>(LEGACY_EDITORIAL_ROUTE_SLUGS);

export function isLegacyEditorialRouteSlug(slug: string | null | undefined): boolean {
  return Boolean(slug && LEGACY_EDITORIAL_ROUTE_SLUG_SET.has(slug));
}

export function getLegacyEditorialRouteArticlePath(
  slug: string | null | undefined,
): string | null {
  if (!slug || !isLegacyEditorialRouteSlug(slug)) return null;
  return `/${LEGACY_EDITORIAL_ROUTE_ARTICLE_CITY_SLUG}/blog/${slug}`;
}
