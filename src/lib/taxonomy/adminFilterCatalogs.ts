/**
 * Реестр справочников hub-страницы `/admin/taxonomy/filters` (доп. каталоги).
 * Основная навигация по осям Discovery — в `AdminSidebar` (группа Discovery).
 */
export type AdminFilterCatalogEntry = {
  id: string;
  title: string;
  description: string;
  href: string;
  implemented: boolean;
};

export const ADMIN_FILTER_CATALOGS: AdminFilterCatalogEntry[] = [
  {
    id: "event-categories",
    title: "Категории (taxonomy)",
    description:
      "Единый справочник категорий по типам публикаций: события, места, офферы, маршруты, статьи.",
    href: "/admin/taxonomy/categories",
    implemented: true,
  },
  {
    id: "place-categories",
    title: "Категории мест",
    description: "Используйте таб Places на странице категорий.",
    href: "/admin/taxonomy/categories?type=PLACE",
    implemented: true,
  },
  {
    id: "offer-categories",
    title: "Категории предложений",
    description: "Используйте таб Offers на странице категорий.",
    href: "/admin/taxonomy/categories?type=OFFER",
    implemented: true,
  },
  {
    id: "quick-filters",
    title: "Быстрые фильтры",
    description: "Плейсхолдер.",
    href: "/admin/taxonomy/filters/quick",
    implemented: false,
  },
  {
    id: "date-filters",
    title: "Дата",
    description: "Плейсхолдер.",
    href: "/admin/taxonomy/filters/date",
    implemented: false,
  },
];
