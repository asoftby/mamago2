import { buildAdminPath } from "@/lib/routing/surface";

export type SeoNavItem = {
  href: string;
  label: string;
  description: string;
};

const SEO_ROOT = buildAdminPath("/seo");
const SEO_SETTINGS = `${SEO_ROOT}/settings`;

/** Ежедневные рабочие разделы SEO */
export const SEO_PRIMARY_NAV: SeoNavItem[] = [
  {
    href: SEO_ROOT,
    label: "Обзор",
    description: "Состояние SEO и что требует внимания",
  },
  {
    href: `${SEO_ROOT}/content`,
    label: "Контент",
    description: "План, темы и опубликованные материалы",
  },
  {
    href: `${SEO_ROOT}/pages`,
    label: "Страницы",
    description: "SEO существующих страниц по геоконтексту",
  },
  {
    href: `${SEO_ROOT}/search`,
    label: "Поиск",
    description: "Запросы и поисковая динамика",
  },
];

/** Технические настройки — вне ежедневного потока */
export const SEO_SETTINGS_NAV: SeoNavItem[] = [
  {
    href: `${SEO_SETTINGS}/indexation`,
    label: "Индексация",
    description: "Sitemap, robots и глобальная индексация",
  },
  {
    href: `${SEO_SETTINGS}/redirects`,
    label: "Редиректы",
    description: "Миграционные и системные редиректы",
  },
  {
    href: `${SEO_SETTINGS}/schema`,
    label: "Структурированные данные",
    description: "JSON-LD и schema.org",
  },
  {
    href: `${SEO_SETTINGS}/ai-search`,
    label: "AI Search",
    description: "llms.txt и готовность к AI-поиску",
  },
];

/** @deprecated Используйте SEO_PRIMARY_NAV + SEO_SETTINGS_NAV */
export const SEO_CONTROL_NAV: SeoNavItem[] = [
  ...SEO_PRIMARY_NAV,
  ...SEO_SETTINGS_NAV,
];

export const SEO_LEGACY_REDIRECTS: Record<string, string> = {
  [`${SEO_ROOT}/sitemap`]: `${SEO_SETTINGS}/indexation`,
  [`${SEO_ROOT}/redirects`]: `${SEO_SETTINGS}/redirects`,
  [`${SEO_ROOT}/schema`]: `${SEO_SETTINGS}/schema`,
  [`${SEO_ROOT}/llms-txt`]: `${SEO_SETTINGS}/ai-search`,
  [`${SEO_ROOT}/templates`]: SEO_ROOT,
};

export function isSeoNavActive(pathname: string, itemHref: string): boolean {
  if (itemHref === SEO_ROOT) {
    return pathname === SEO_ROOT || pathname === `${SEO_ROOT}/`;
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

export function isSeoSettingsPath(pathname: string): boolean {
  return pathname.startsWith(SEO_SETTINGS);
}

/** Entry point for «Настройки SEO» in the main admin sidebar (not the technical sub-items). */
export const SEO_SETTINGS_ENTRY = {
  href: `${SEO_SETTINGS}/indexation`,
  label: "Настройки SEO",
  description: "Индексация, редиректы, schema.org и AI Search",
} as const;

/**
 * Main admin sidebar SEO items: product sections + single settings entry.
 * Technical settings sub-items stay only in SeoSubNav secondary nav.
 */
export function getSeoAdminSidebarItems(): Array<{ label: string; href: string }> {
  return [
    ...SEO_PRIMARY_NAV.map((item) => ({ label: item.label, href: item.href })),
    { label: SEO_SETTINGS_ENTRY.label, href: SEO_SETTINGS_ENTRY.href },
  ];
}

/** Geo context is product-scoped; global SEO settings must not imply city filtering. */
export function shouldShowSeoGeoContextSelector(pathname: string): boolean {
  return !isSeoSettingsPath(pathname);
}
