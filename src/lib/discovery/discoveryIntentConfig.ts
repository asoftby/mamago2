import { Intent } from "@/lib/intent";
import { buildPublicPath } from "@/lib/routing/surface";

export interface DiscoveryIntentConfig {
  id: Intent;
  label: string;
  titleTemplate: string; // Template with {city} placeholder
  href: (city: string) => string;
  hasFilters: boolean;
  icon?: string;
  image?: string;
  /**
   * Доступность раздела в primary navigation (desktop header + mobile landing
   * header, обе поверхности рендерятся через `DiscoveryIntentTabs`) — и только
   * там. Не влияет на route, loader'ы, API, sitemap, canonical, robots,
   * индексацию, redirect-манифест или внутреннюю перелинковку вне этих двух
   * поверхностей.
   */
  navigationEnabled: boolean;
  /**
   * Визуальное состояние «Скоро» для пункта в primary navigation. Требует
   * `navigationEnabled: false` — раздел не может одновременно быть кликабельным
   * и помечен как «Скоро» (см. `discoveryIntentConfig.test.ts`).
   */
  comingSoon: boolean;
}

export const DISCOVERY_INTENT_CONFIG: Record<Intent, DiscoveryIntentConfig> = {
  kuda: {
    id: "kuda",
    label: "Куда пойти",
    titleTemplate: "Куда пойти с ребёнком в {city}",
    /** Канонический листинг — `/{city}/events` (редирект с `/{city}/kuda`). */
    href: (city) => `/${city}/events`,
    hasFilters: true,
    image: "/compass.svg",
    navigationEnabled: true,
    comingSoon: false,
  },
  classes: {
    id: "classes",
    label: "Занятия",
    titleTemplate: "Детские занятия и секции в {city}",
    href: (city) => `/${city}/classes`,
    hasFilters: true,
    image: "/palette.svg",
    navigationEnabled: false,
    comingSoon: true,
  },
  birthday: {
    id: "birthday",
    label: "Праздник",
    titleTemplate: "Организация детского праздника в {city}",
    href: (city) => `/${city}/birthday`,
    hasFilters: true,
    image: "/hb.svg",
    navigationEnabled: false,
    comingSoon: true,
  },
  routes: {
    id: "routes",
    label: "Маршруты",
    titleTemplate: "Готовые маршруты для прогулок с детьми в {city}",
    href: (city) => `/${city}/routes`,
    hasFilters: true,
    image: "/routes.svg",
    navigationEnabled: false,
    comingSoon: true,
  },
};

// Helper to get all intent configs as array (for tabs)
export const DISCOVERY_INTENT_ITEMS = Object.values(DISCOVERY_INTENT_CONFIG);

export type PrimaryNavigationId = Intent | "journal";

export type PrimaryNavigationItem = Pick<
  DiscoveryIntentConfig,
  "label" | "href" | "image" | "navigationEnabled" | "comingSoon"
> & {
  id: PrimaryNavigationId;
};

/** Primary navigation order is independent from discovery/search intent order. */
export const PRIMARY_NAVIGATION_ITEMS: PrimaryNavigationItem[] = [
  DISCOVERY_INTENT_CONFIG.kuda,
  {
    id: "journal",
    label: "Журнал",
    href: (city) => buildPublicPath(`/${city}/blog`),
    image: "/mag.svg",
    navigationEnabled: true,
    comingSoon: false,
  },
  DISCOVERY_INTENT_CONFIG.classes,
  DISCOVERY_INTENT_CONFIG.birthday,
  DISCOVERY_INTENT_CONFIG.routes,
];
