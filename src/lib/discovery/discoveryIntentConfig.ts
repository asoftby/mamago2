import { Intent } from "@/lib/intent";

export interface DiscoveryIntentConfig {
  id: Intent;
  label: string;
  titleTemplate: string; // Template with {city} placeholder
  href: (city: string) => string;
  hasFilters: boolean;
  icon?: string;
  image?: string;
}

export const DISCOVERY_INTENT_CONFIG: Record<Intent, DiscoveryIntentConfig> = {
  kuda: {
    id: "kuda",
    label: "Куда пойти",
    titleTemplate: "Куда пойти с ребёнком в {city}",
    /** Минск: отдельный сегмент discovery; остальные города — пока корень /{city} */
    href: (city) => (city === "minsk" ? "/minsk/kuda" : `/${city}`),
    hasFilters: true,
    image: "/compass.svg",
  },
  classes: {
    id: "classes",
    label: "Занятия",
    titleTemplate: "Детские занятия и секции в {city}",
    href: (city) => `/${city}/classes`,
    hasFilters: true,
    image: "/palette.svg",
  },
  birthday: {
    id: "birthday",
    label: "ДР",
    titleTemplate: "Организация детского праздника в {city}",
    href: (city) => `/${city}/birthday`,
    hasFilters: true,
    image: "/hb.svg",
  },
  routes: {
    id: "routes",
    label: "Маршруты",
    titleTemplate: "Готовые маршруты для прогулок с детьми в {city}",
    href: (city) => `/${city}/routes`,
    hasFilters: true,
    image: "/mag.svg",
  },
};

// Helper to get all intent configs as array (for tabs)
export const DISCOVERY_INTENT_ITEMS = Object.values(DISCOVERY_INTENT_CONFIG);