import { buildAdminPath } from "@/lib/routing/surface";

export type SeoNavItem = {
  href: string;
  label: string;
  description: string;
};

const SEO_ROOT = buildAdminPath("/seo");

/** Внутренняя навигация SEO Control Center (порядок = порядок вкладок) */
export const SEO_CONTROL_NAV: SeoNavItem[] = [
  {
    href: SEO_ROOT,
    label: "Dashboard",
    description: "Обзор метрик и статусов",
  },
  {
    href: `${SEO_ROOT}/pages`,
    label: "SEO Pages",
    description: "Title, meta, каноникалы по страницам",
  },
  {
    href: `${SEO_ROOT}/redirects`,
    label: "Redirects",
    description: "301/302 и правила перенаправлений",
  },
  {
    href: `${SEO_ROOT}/templates`,
    label: "Templates",
    description: "Шаблоны заголовков и описаний",
  },
  {
    href: `${SEO_ROOT}/schema`,
    label: "Structured Data",
    description: "JSON-LD и разметка",
  },
  {
    href: `${SEO_ROOT}/llms-txt`,
    label: "llms.txt",
    description: "AI Search Readiness и инструкции для LLM",
  },
  {
    href: `${SEO_ROOT}/sitemap`,
    label: "Sitemap",
    description: "Sitemap.xml и robots.txt",
  },
];

export function isSeoNavActive(pathname: string, itemHref: string): boolean {
  if (itemHref === SEO_ROOT) {
    return pathname === SEO_ROOT || pathname === `${SEO_ROOT}/`;
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}
