import type { SeoTemplateScope, SeoTemplateVariableDoc } from "./types";

export const SEO_TEMPLATE_VARIABLE_DOCS: SeoTemplateVariableDoc[] = [
  {
    key: "city",
    description: "Город (из контекста страницы / сущности)",
    example: "Москва",
  },
  {
    key: "dateLabel",
    description: "Дата в человекочитаемом виде",
    example: "15 марта 2025",
  },
  {
    key: "category",
    description: "Название категории или рубрики",
    example: "Концерты",
  },
  {
    key: "entityTitle",
    description: "Заголовок сущности (событие, место, статья и т.д.)",
    example: "Джазовый вечер",
  },
];

export const SEO_TEMPLATE_SCOPE_ORDER: SeoTemplateScope[] = [
  "preset_page",
  "category_page",
  "article_page",
  "event_page",
  "place_page",
];

export const SEO_TEMPLATE_SCOPE_LABEL: Record<SeoTemplateScope, string> = {
  preset_page: "Preset pages",
  category_page: "Category pages",
  article_page: "Article pages",
  event_page: "Event pages",
  place_page: "Place pages",
};
