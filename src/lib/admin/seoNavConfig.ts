import { buildAdminPath } from "@/lib/routing/surface";

export type SeoNavItem = {
  href: string;
  label: string;
  description: string;
};

const SEO_ROOT = buildAdminPath("/seo");
const SEO_SETTINGS = `${SEO_ROOT}/settings`;

/**
 * User-facing SEO navigation (daily work).
 */
export const SEO_PRIMARY_NAV: SeoNavItem[] = [
  {
    href: SEO_ROOT,
    label: "Обзор",
    description: "Состояние SEO и что требует внимания",
  },
  {
    href: `${SEO_ROOT}/pages`,
    label: "Страницы",
    description: "SEO существующих страниц по георынку",
  },
  {
    href: `${SEO_ROOT}/plan`,
    label: "План контента",
    description: "Темы к публикации по SEO-рынку",
  },
  {
    href: `${SEO_ROOT}/topics`,
    label: "Темы и тренды",
    description: "Внутренний спрос mamaGo и идеи для плана",
  },
];

/**
 * Legacy foundation routes — redirect to overview; kept for bookmarks.
 */
export const SEO_FOUNDATION_NAV: SeoNavItem[] = [
  {
    href: `${SEO_ROOT}/content`,
    label: "Контент",
    description: "План, темы и опубликованные материалы",
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
  [`${SEO_ROOT}/content`]: SEO_ROOT,
  [`${SEO_ROOT}/search`]: SEO_ROOT,
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

export const SEO_SETTINGS_ENTRY = {
  href: `${SEO_SETTINGS}/indexation`,
  label: "Настройки SEO",
  description: "Индексация, редиректы, schema.org и AI Search",
} as const;

export function getSeoAdminSidebarItems(): Array<{ label: string; href: string }> {
  return [
    ...SEO_PRIMARY_NAV.map((item) => ({ label: item.label, href: item.href })),
    { label: SEO_SETTINGS_ENTRY.label, href: SEO_SETTINGS_ENTRY.href },
  ];
}

/**
 * SEO Market selector on product geo-aware pages only (not Settings).
 */
export function shouldShowSeoGeoContextSelector(pathname: string): boolean {
  if (pathname === SEO_ROOT || pathname === `${SEO_ROOT}/`) return true;
  if (pathname === `${SEO_ROOT}/pages` || pathname.startsWith(`${SEO_ROOT}/pages/`)) {
    return true;
  }
  if (pathname === `${SEO_ROOT}/plan` || pathname.startsWith(`${SEO_ROOT}/plan/`)) {
    return true;
  }
  if (pathname === `${SEO_ROOT}/topics` || pathname.startsWith(`${SEO_ROOT}/topics/`)) {
    return true;
  }
  return false;
}

export const SEO_PAGES_PAGE_SIZES = [25, 50, 100] as const;
export type SeoPagesPageSize = (typeof SEO_PAGES_PAGE_SIZES)[number];
export const SEO_PAGES_DEFAULT_PAGE_SIZE: SeoPagesPageSize = 25;

export function parseSeoPagesPageSize(raw: string | undefined | null): SeoPagesPageSize {
  if (!raw) return SEO_PAGES_DEFAULT_PAGE_SIZE;
  const n = Number(raw);
  if ((SEO_PAGES_PAGE_SIZES as readonly number[]).includes(n)) {
    return n as SeoPagesPageSize;
  }
  return SEO_PAGES_DEFAULT_PAGE_SIZE;
}
