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
    title: "Категории событий",
    description: "Справочник категорий для событий и активностей (отдельно от сигналов и ranking).",
    href: "/admin/taxonomy/filters/event-categories",
    implemented: true,
  },
  {
    id: "place-categories",
    title: "Категории мест",
    description: "Плейсхолдер — будет добавлено по той же схеме.",
    href: "/admin/taxonomy/filters/place-categories",
    implemented: false,
  },
  {
    id: "offer-categories",
    title: "Категории предложений",
    description: "Плейсхолдер — будет добавлено по той же схеме.",
    href: "/admin/taxonomy/filters/offer-categories",
    implemented: false,
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
