import { adminPath } from "@/lib/routing/surface";
import type { AdminSidebarNavItem, AdminSidebarGroup } from "./adminSidebarTypes";
import {
  LayoutDashboard,
  Shield,
  Users,
  Briefcase,
  CreditCard,
  FileText,
  Image,
  Filter,
  MapPin,
  Globe,
  BarChart2,
  ChartColumn,
  Megaphone,
  Download,
  Search,
  Server,
} from "lucide-react";

/**
 * Admin Sidebar Navigation Configuration
 * 
 * Architecture:
 * - Top-level sections are standalone items or groups
 * - Each section has: id, label, href, icon, optional children
 * - Groups are collapsible sections with multiple sub-items
 * - Order determines display order in sidebar
 */

// === STANDALONE NAV ITEMS ===

export const NAV_MAIN: AdminSidebarNavItem = {
  id: "main",
  label: "Панель управления",
  href: adminPath(""),
  icon: LayoutDashboard,
};

export const NAV_COMMUNICATIONS: AdminSidebarNavItem = {
  id: "communications",
  label: "Коммуникации",
  href: adminPath("/communications"),
  icon: Megaphone,
  children: [
    {
      id: "communications-overview",
      label: "Обзор",
      href: adminPath("/communications"),
      matchers: [{ type: "exact", value: adminPath("/communications") }],
    },
    {
      id: "communications-scenarios",
      label: "Сценарии",
      href: adminPath("/communications/notifications"),
      matchers: [
        { type: "exact", value: adminPath("/communications/notifications") },
        { type: "prefix", value: adminPath("/communications/scenarios") },
      ],
    },
    {
      id: "communications-channels",
      label: "Каналы",
      href: adminPath("/communications/channels/email"),
      matchers: [{ type: "prefix", value: adminPath("/communications/channels") }],
    },
    {
      id: "communications-notification-deliveries",
      label: "Deliveries",
      href: adminPath("/communications/notifications/deliveries"),
      matchers: [{ type: "prefix", value: adminPath("/communications/notifications/deliveries") }],
    },
    {
      id: "communications-editorial-requests",
      label: "Редакционные запросы",
      href: adminPath("/content/editorial-requests"),
      matchers: [{ type: "prefix", value: adminPath("/content/editorial-requests") }],
    },
    {
      id: "communications-direct",
      label: "Direct",
      href: adminPath("/communications/direct"),
      matchers: [{ type: "prefix", value: adminPath("/communications/direct") }],
    },
  ],
};

export const NAV_ANALYTICS: AdminSidebarNavItem = {
  id: "analytics",
  label: "Analytics",
  href: adminPath("/analytics"),
  icon: ChartColumn,
};

// === IMPORT SECTION (STANDALONE TOP-LEVEL) ===

export const NAV_IMPORT: AdminSidebarNavItem = {
  id: "import",
  label: "Импорт",
  href: adminPath("/import"),
  icon: Download,
  children: [
    {
      id: "import-overview",
      label: "Обзор",
      href: adminPath("/import"),
      matchers: [{ type: "exact", value: adminPath("/import") }],
    },
    {
      id: "import-sources",
      label: "Источники",
      href: adminPath("/import/sources"),
      matchers: [{ type: "prefix", value: adminPath("/import/sources") }],
    },
    {
      id: "import-runs",
      label: "Запуски",
      href: adminPath("/import/runs"),
      matchers: [{ type: "prefix", value: adminPath("/import/runs") }],
    },
    {
      id: "import-queue",
      label: "Очередь",
      href: adminPath("/import/review"),
      matchers: [{ type: "prefix", value: adminPath("/import/review") }],
      badgeCountKey: "importPendingReviewCount",
    },
    {
      id: "import-debug",
      label: "Debug",
      href: adminPath("/import/debug/parser"),
      matchers: [{ type: "prefix", value: adminPath("/import/debug") }],
    },
  ],
};

// === GROUPS WITH SUB-ITEMS ===

export const GROUP_MODERATION: AdminSidebarGroup = {
  id: "moderation",
  label: "Модерация",
  icon: Shield,
  children: [
    {
      id: "moderation-queue",
      label: "Очередь",
      href: adminPath("/moderation/queue"),
      matchers: [{ type: "prefix", value: adminPath("/moderation/queue") }],
      badgeCountKey: "queueTotal",
    },
    {
      id: "moderation-reviews",
      label: "Отзывы",
      href: adminPath("/moderation/reviews"),
      matchers: [{ type: "prefix", value: adminPath("/moderation/reviews") }],
      badgeCountKey: "reviewsPendingCount",
    },
  ],
};

export const GROUP_USERS: AdminSidebarGroup = {
  id: "users",
  label: "Пользователи",
  icon: Users,
  children: [
    {
      id: "users-list",
      label: "Пользователи",
      href: adminPath("/users"),
      matchers: [{ type: "prefix", value: adminPath("/users") }],
    },
  ],
};

export const GROUP_B2B: AdminSidebarGroup = {
  id: "b2b",
  label: "B2B",
  icon: Briefcase,
  children: [
    {
      id: "b2b-requests",
      label: "Заявки",
      href: adminPath("/b2b/requests"),
      matchers: [{ type: "prefix", value: adminPath("/b2b/requests") }],
      badgeCountKey: "b2bPendingVerificationCount",
    },
    {
      id: "b2b-partners",
      label: "Контрагенты",
      href: adminPath("/b2b/partners"),
      matchers: [{ type: "prefix", value: adminPath("/b2b/partners") }],
    },
    {
      id: "b2b-access-requests",
      label: "Доступы",
      href: adminPath("/b2b/access-requests"),
      matchers: [{ type: "prefix", value: adminPath("/b2b/access-requests") }],
    },
    {
      id: "b2b-orders",
      label: "Заказы",
      href: adminPath("/orders"),
      matchers: [{ type: "prefix", value: adminPath("/orders") }],
    },
  ],
};

export const GROUP_BILLING: AdminSidebarGroup = {
  id: "billing",
  label: "Биллинг",
  icon: CreditCard,
  children: [
    {
      id: "billing-overview",
      label: "Обзор",
      href: adminPath("/billing"),
      matchers: [{ type: "prefix", value: adminPath("/billing") }],
    },
    {
      id: "billing-transactions",
      label: "Транзакции",
      href: adminPath("/billing/transactions"),
      matchers: [{ type: "prefix", value: adminPath("/billing/transactions") }],
    },
    {
      id: "billing-businesses",
      label: "Балансы",
      href: adminPath("/billing/businesses"),
      matchers: [{ type: "prefix", value: adminPath("/billing/businesses") }],
    },
    {
      id: "billing-plans",
      label: "Тарифы",
      href: adminPath("/billing/plans"),
      matchers: [{ type: "prefix", value: adminPath("/billing/plans") }],
    },
  ],
};

export const GROUP_COMMERCIAL: AdminSidebarGroup = {
  id: "commercial",
  label: "Коммерция",
  icon: FileText,
  children: [
    {
      id: "commercial-overview",
      label: "Обзор",
      href: adminPath("/commercial"),
      matchers: [{ type: "prefix", value: adminPath("/commercial") }],
    },
    {
      id: "commercial-contracts",
      label: "Договоры",
      href: adminPath("/commercial/contracts"),
      matchers: [{ type: "prefix", value: adminPath("/commercial/contracts") }],
    },
    {
      id: "commercial-placements",
      label: "Размещения",
      href: adminPath("/commercial/placements"),
      matchers: [{ type: "prefix", value: adminPath("/commercial/placements") }],
    },
    {
      id: "commercial-service-placements",
      label: "Услуги",
      href: adminPath("/commercial/service-placements"),
      matchers: [{ type: "prefix", value: adminPath("/commercial/service-placements") }],
    },
  ],
};

export const GROUP_CONTENT: AdminSidebarGroup = {
  id: "content",
  label: "Контент",
  icon: Image,
  children: [
    {
      id: "content-events",
      label: "События",
      href: adminPath("/content/events"),
      matchers: [{ type: "prefix", value: adminPath("/content/events") }],
    },
    {
      id: "content-places",
      label: "Места",
      href: adminPath("/content/places"),
      matchers: [{ type: "prefix", value: adminPath("/content/places") }],
    },
    {
      id: "content-offers",
      label: "Предложения",
      href: adminPath("/content/offers"),
      matchers: [{ type: "prefix", value: adminPath("/content/offers") }],
    },
    {
      id: "content-routes",
      label: "Маршруты",
      href: adminPath("/content/routes"),
      matchers: [{ type: "prefix", value: adminPath("/content/routes") }],
    },
    {
      id: "content-publications",
      label: "Публикации",
      href: adminPath("/content/publications"),
      matchers: [{ type: "prefix", value: adminPath("/content/publications") }],
    },
    {
      id: "content-pages",
      label: "Страницы",
      href: adminPath("/pages"),
      matchers: [{ type: "prefix", value: adminPath("/pages") }],
    },
    {
      id: "content-media",
      label: "Медиатека",
      href: adminPath("/media"),
      matchers: [{ type: "prefix", value: adminPath("/media") }],
    },
  ],
};

export const GROUP_SEARCH: AdminSidebarGroup = {
  id: "search",
  label: "Поиск",
  icon: Search,
  children: [
    {
      id: "search-overview",
      label: "Overview",
      href: adminPath("/search"),
      matchers: [{ type: "exact", value: adminPath("/search") }],
    },
    {
      id: "search-quick-tags",
      label: "Quick Tags",
      href: adminPath("/search/quick-tags"),
      matchers: [{ type: "prefix", value: adminPath("/search/quick-tags") }],
    },
    {
      id: "search-synonyms",
      label: "Synonyms",
      href: adminPath("/search/synonyms"),
      matchers: [{ type: "prefix", value: adminPath("/search/synonyms") }],
    },
    {
      id: "search-zero-results",
      label: "Zero Results",
      href: adminPath("/search/zero-results"),
      matchers: [{ type: "prefix", value: adminPath("/search/zero-results") }],
    },
    {
      id: "search-index",
      label: "Index",
      href: adminPath("/search/index"),
      matchers: [{ type: "prefix", value: adminPath("/search/index") }],
    },
    {
      id: "search-ranking",
      label: "Ranking",
      href: adminPath("/search/ranking"),
      matchers: [{ type: "prefix", value: adminPath("/search/ranking") }],
    },
  ],
};

export const GROUP_DISCOVERY: AdminSidebarGroup = {
  id: "discovery",
  label: "Discovery",
  icon: Filter,
  children: [
    {
      id: "discovery-signals",
      label: "Сигналы",
      href: adminPath("/taxonomy/signals"),
      matchers: [{ type: "prefix", value: adminPath("/taxonomy/signals") }],
    },
    {
      id: "discovery-categories",
      label: "Категории",
      href: adminPath("/taxonomy/categories"),
      matchers: [{ type: "prefix", value: adminPath("/taxonomy/categories") }],
    },
    {
      id: "discovery-tags",
      label: "Теги",
      href: adminPath("/taxonomy/discovery-tags"),
      matchers: [
        { type: "prefix", value: adminPath("/taxonomy/discovery-tags") },
        { type: "prefix", value: adminPath("/discovery/tags") },
      ],
    },
    {
      id: "discovery-occasions",
      label: "Поводы",
      href: adminPath("/discovery/occasions"),
      matchers: [{ type: "prefix", value: adminPath("/discovery/occasions") }],
    },
    {
      id: "discovery-genres",
      label: "Жанры",
      href: adminPath("/taxonomy/genres"),
      matchers: [{ type: "prefix", value: adminPath("/taxonomy/genres") }],
    },
    {
      id: "discovery-filters",
      label: "Фильтры",
      href: adminPath("/discovery/filters"),
      matchers: [{ type: "prefix", value: adminPath("/discovery/filters") }],
    },
  ],
};

export const GROUP_RANKING: AdminSidebarGroup = {
  id: "ranking",
  label: "Ranking",
  icon: BarChart2,
  children: [
    {
      id: "ranking-stories-intents",
      label: "Stories Intents",
      href: adminPath("/ranking/stories-intents"),
      matchers: [{ type: "prefix", value: adminPath("/ranking/stories-intents") }],
    },
    {
      id: "ranking-weights",
      label: "Ranking Weights",
      href: adminPath("/ranking/weights"),
      matchers: [{ type: "prefix", value: adminPath("/ranking/weights") }],
    },
    {
      id: "ranking-boost",
      label: "Boost Rules",
      href: adminPath("/ranking/boost"),
      matchers: [{ type: "prefix", value: adminPath("/ranking/boost") }],
    },
  ],
};

export const GROUP_GEOGRAPHY: AdminSidebarGroup = {
  id: "geography",
  label: "География",
  icon: MapPin,
  children: [
    {
      id: "geography-cities",
      label: "Города",
      href: adminPath("/taxonomy/cities"),
      matchers: [{ type: "prefix", value: adminPath("/taxonomy/cities") }],
    },
    {
      id: "geography-districts",
      label: "Районы",
      href: adminPath("/taxonomy/districts"),
      matchers: [{ type: "prefix", value: adminPath("/taxonomy/districts") }],
    },
    {
      id: "geography-metro",
      label: "Станции метро",
      href: adminPath("/taxonomy/metro-stations"),
      matchers: [{ type: "prefix", value: adminPath("/taxonomy/metro-stations") }],
    },
  ],
};

export const GROUP_SEO: AdminSidebarGroup = {
  id: "seo",
  label: "SEO",
  icon: Globe,
  children: [
    {
      id: "seo-dashboard",
      label: "Dashboard",
      href: adminPath("/seo"),
      matchers: [{ type: "exact", value: adminPath("/seo") }],
    },
    {
      id: "seo-pages",
      label: "SEO Pages",
      href: adminPath("/seo/pages"),
      matchers: [{ type: "prefix", value: adminPath("/seo/pages") }],
    },
    {
      id: "seo-redirects",
      label: "Redirects",
      href: adminPath("/seo/redirects"),
      matchers: [{ type: "prefix", value: adminPath("/seo/redirects") }],
    },
    {
      id: "seo-templates",
      label: "Templates",
      href: adminPath("/seo/templates"),
      matchers: [{ type: "prefix", value: adminPath("/seo/templates") }],
    },
    {
      id: "seo-schema",
      label: "Structured Data",
      href: adminPath("/seo/schema"),
      matchers: [{ type: "prefix", value: adminPath("/seo/schema") }],
    },
    {
      id: "seo-llms-txt",
      label: "llms.txt",
      href: adminPath("/seo/llms-txt"),
      matchers: [{ type: "prefix", value: adminPath("/seo/llms-txt") }],
    },
    {
      id: "seo-sitemap",
      label: "Sitemap",
      href: adminPath("/seo/sitemap"),
      matchers: [{ type: "prefix", value: adminPath("/seo/sitemap") }],
    },
  ],
};

export const GROUP_SYSTEM: AdminSidebarGroup = {
  id: "system",
  label: "Система",
  icon: Server,
  children: [
    {
      id: "system-build",
      label: "Сборка",
      href: adminPath("/system/build"),
      matchers: [{ type: "prefix", value: adminPath("/system/build") }],
    },
    {
      id: "system-branding",
      label: "Оформление",
      href: adminPath("/system/branding"),
      matchers: [{ type: "prefix", value: adminPath("/system/branding") }],
    },
  ],
};

// === FULL SIDEBAR CONFIGURATION ===

/**
 * Complete sidebar navigation structure
 * Order determines display order in sidebar
 */
export const ADMIN_SIDEBAR_CONFIG: readonly (AdminSidebarNavItem | AdminSidebarGroup)[] = [
  NAV_MAIN,
  GROUP_MODERATION,
  GROUP_USERS,
  GROUP_B2B,
  GROUP_BILLING,
  GROUP_COMMERCIAL,
  GROUP_CONTENT,
  NAV_COMMUNICATIONS,
  GROUP_SEARCH,
  GROUP_DISCOVERY,
  GROUP_RANKING,
  NAV_ANALYTICS,
  GROUP_GEOGRAPHY,
  GROUP_SEO,
  GROUP_SYSTEM,
  NAV_IMPORT, // Import is now a standalone top-level section
];

// === TYPE EXPORTS ===

export type { AdminSidebarNavItem, AdminSidebarGroup } from "./adminSidebarTypes";
