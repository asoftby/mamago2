import type { SeoTemplate } from "../domain/types";

/** Мок-данные; заменить загрузкой с бэкенда */
export const MOCK_SEO_TEMPLATES: SeoTemplate[] = [
  {
    id: "tpl-preset-city-default",
    name: "City preset — default",
    scope: "preset_page",
    appliesToLabel: "Preset-страницы по городу",
    titleTemplate: "{entityTitle} в {city} — афиша и билеты",
    h1Template: "{entityTitle} в {city}",
    descriptionTemplate:
      "События и места в {city}: {entityTitle}. Даты, площадки и билеты на Mamago.",
    active: true,
  },
  {
    id: "tpl-preset-weekend",
    name: "Weekend digest",
    scope: "preset_page",
    appliesToLabel: "Preset «выходные»",
    titleTemplate: "Выходные в {city} — {dateLabel}",
    h1Template: "Что посмотреть в {city} на выходных",
    descriptionTemplate:
      "Подборка событий в {city} на {dateLabel}. Афиша, жанры и билеты.",
    active: false,
  },
  {
    id: "tpl-category-default",
    name: "Category hub",
    scope: "category_page",
    appliesToLabel: "Страницы категорий",
    titleTemplate: "{category} в {city} — афиша",
    h1Template: "{category}",
    descriptionTemplate:
      "{category} в {city}: расписание, площадки и билеты. Обновлено {dateLabel}.",
    active: true,
  },
  {
    id: "tpl-article-default",
    name: "Article SEO",
    scope: "article_page",
    appliesToLabel: "Статьи и гиды",
    titleTemplate: "{entityTitle} — гид Mamago",
    h1Template: "{entityTitle}",
    descriptionTemplate:
      "Материал о {entityTitle}. Полезно перед походом на событие в {city}.",
    active: true,
  },
  {
    id: "tpl-event-default",
    name: "Event detail",
    scope: "event_page",
    appliesToLabel: "Карточка события",
    titleTemplate: "{entityTitle} — {dateLabel}, {city}",
    h1Template: "{entityTitle}",
    descriptionTemplate:
      "{entityTitle}: дата {dateLabel}, город {city}. Билеты и детали на Mamago.",
    active: true,
  },
  {
    id: "tpl-place-default",
    name: "Place detail",
    scope: "place_page",
    appliesToLabel: "Карточка места",
    titleTemplate: "{entityTitle} — {city} | площадка",
    h1Template: "{entityTitle}",
    descriptionTemplate:
      "{entityTitle} в {city}: адрес, события и как добраться. Афиша на Mamago.",
    active: true,
  },
];
