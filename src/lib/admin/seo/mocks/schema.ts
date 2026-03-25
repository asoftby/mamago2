import type {
  SchemaOverviewCard,
  SchemaTemplate,
  SchemaValidationIssue,
} from "../domain/types";

const orgSample: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Mamago",
  url: "https://mamago.example",
  logo: "https://mamago.example/logo.png",
};

const webSiteSample: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Mamago — афиша событий",
  url: "https://mamago.example",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://mamago.example/search?q={query}",
    "query-input": "required name=query",
  },
};

const breadcrumbSample: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Главная", item: "https://mamago.example/" },
    { "@type": "ListItem", position: 2, name: "Москва", item: "https://mamago.example/msk" },
  ],
};

const eventSample: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "Джазовый вечер",
  startDate: "2025-03-20T19:00:00+03:00",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: { "@type": "Place", name: "Клуб А", address: "Москва" },
};

const placeSample: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Клуб А",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Москва",
    streetAddress: "ул. Примерная, 1",
  },
};

const articleSample: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Гид по вечерам в городе",
  datePublished: "2025-03-01",
  author: { "@type": "Organization", name: "Mamago" },
};

const collectionSample: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Концерты в Москве",
  mainEntity: {
    "@type": "ItemList",
    numberOfItems: 42,
    itemListElement: [],
  },
};

export const MOCK_SCHEMA_OVERVIEW_CARDS: SchemaOverviewCard[] = [
  {
    id: "ov-event",
    kind: "event",
    title: "Event schema",
    templateIds: ["tpl-schema-event"],
  },
  {
    id: "ov-place",
    kind: "place_local_business",
    title: "Place / LocalBusiness schema",
    templateIds: ["tpl-schema-place"],
  },
  {
    id: "ov-article",
    kind: "article",
    title: "Article schema",
    templateIds: ["tpl-schema-article"],
  },
  {
    id: "ov-collection",
    kind: "collection_item_list",
    title: "CollectionPage / ItemList schema",
    templateIds: ["tpl-schema-collection"],
  },
  {
    id: "ov-breadcrumb",
    kind: "breadcrumb",
    title: "Breadcrumb schema",
    templateIds: ["tpl-schema-breadcrumb"],
  },
  {
    id: "ov-org-web",
    kind: "organization_website",
    title: "Global Organization / WebSite schema",
    templateIds: ["tpl-schema-organization", "tpl-schema-website"],
  },
];

export const MOCK_SCHEMA_TEMPLATES: SchemaTemplate[] = [
  {
    id: "tpl-schema-organization",
    schemaType: "Organization",
    appliesTo: "Глобальный футер / главная",
    active: true,
    status: "ok",
    coverageCount: 12400,
    warningsCount: 0,
    fieldMappings: [
      { schemaField: "name", source: "siteConfig.brandName" },
      { schemaField: "url", source: "siteConfig.canonicalOrigin" },
      { schemaField: "logo", source: "media.brandLogoUrl" },
      { schemaField: "sameAs", source: "socialProfiles[]" },
    ],
    requiredFields: [
      { key: "name", satisfied: true },
      { key: "url", satisfied: true },
      { key: "logo", satisfied: true },
    ],
    sampleJsonLd: orgSample,
  },
  {
    id: "tpl-schema-website",
    schemaType: "WebSite",
    appliesTo: "Главная, поиск",
    active: true,
    status: "ok",
    coverageCount: 11800,
    warningsCount: 1,
    fieldMappings: [
      { schemaField: "name", source: "siteConfig.siteTitle" },
      { schemaField: "url", source: "siteConfig.canonicalOrigin" },
      { schemaField: "potentialAction", source: "search.searchActionTemplate" },
    ],
    requiredFields: [
      { key: "name", satisfied: true },
      { key: "url", satisfied: true },
    ],
    sampleJsonLd: webSiteSample,
  },
  {
    id: "tpl-schema-breadcrumb",
    schemaType: "BreadcrumbList",
    appliesTo: "Все страницы с trail",
    active: true,
    status: "ok",
    coverageCount: 9800,
    warningsCount: 0,
    fieldMappings: [
      { schemaField: "itemListElement", source: "page.breadcrumbs[]" },
    ],
    requiredFields: [
      { key: "itemListElement", satisfied: true },
    ],
    sampleJsonLd: breadcrumbSample,
  },
  {
    id: "tpl-schema-event",
    schemaType: "Event",
    appliesTo: "Карточка события",
    active: true,
    status: "ok",
    coverageCount: 4200,
    warningsCount: 12,
    fieldMappings: [
      { schemaField: "name", source: "event.title" },
      { schemaField: "startDate", source: "event.startsAt" },
      { schemaField: "location", source: "event.venue | place" },
      { schemaField: "offers", source: "event.ticketUrl" },
    ],
    requiredFields: [
      { key: "name", satisfied: true },
      { key: "startDate", satisfied: true },
      { key: "location", satisfied: true },
    ],
    sampleJsonLd: eventSample,
  },
  {
    id: "tpl-schema-place",
    schemaType: "Place",
    appliesTo: "Карточка места / venue",
    active: true,
    status: "degraded",
    coverageCount: 2100,
    warningsCount: 8,
    fieldMappings: [
      { schemaField: "name", source: "place.name" },
      { schemaField: "address", source: "place.addressStructured" },
      { schemaField: "geo", source: "place.coordinates" },
    ],
    requiredFields: [
      { key: "name", satisfied: true },
      { key: "address", satisfied: false },
    ],
    sampleJsonLd: placeSample,
  },
  {
    id: "tpl-schema-article",
    schemaType: "Article",
    appliesTo: "Статьи и гиды",
    active: true,
    status: "ok",
    coverageCount: 640,
    warningsCount: 2,
    fieldMappings: [
      { schemaField: "headline", source: "article.title" },
      { schemaField: "datePublished", source: "article.publishedAt" },
      { schemaField: "author", source: "article.authorEntity" },
    ],
    requiredFields: [
      { key: "headline", satisfied: true },
      { key: "datePublished", satisfied: true },
    ],
    sampleJsonLd: articleSample,
  },
  {
    id: "tpl-schema-collection",
    schemaType: "CollectionPage",
    appliesTo: "Листинги, категории, подборки",
    active: true,
    status: "ok",
    coverageCount: 3100,
    warningsCount: 4,
    fieldMappings: [
      { schemaField: "name", source: "listing.pageTitle" },
      { schemaField: "mainEntity", source: "listing.itemListFromResults" },
    ],
    requiredFields: [
      { key: "name", satisfied: true },
      { key: "mainEntity", satisfied: true },
    ],
    sampleJsonLd: collectionSample,
  },
];

export const MOCK_SCHEMA_VALIDATION: SchemaValidationIssue[] = [
  {
    id: "val-1",
    category: "missing_required",
    severity: "error",
    title: "LocalBusiness: нет полного address",
    detail:
      "У 14 площадок не заполнен structured address — разметка места ослаблена.",
    pageUrl: "/places/venue-old-442",
  },
  {
    id: "val-2",
    category: "disabled_incomplete",
    severity: "warning",
    title: "Event: offers отключены из‑за отсутствия URL билета",
    detail: "Схема Event без блока offers для черновиков событий.",
  },
  {
    id: "val-3",
    category: "no_structured_data",
    severity: "error",
    title: "Страница без JSON-LD",
    detail: "Статическая страница не привязана ни к одному шаблону схемы.",
    pageUrl: "/legal/legacy-terms",
  },
  {
    id: "val-4",
    category: "warning",
    severity: "warning",
    title: "BreadcrumbList: несовпадение длины с URL",
    detail: "На 3 страницах категорий хлебные крошки короче, чем глубина пути.",
    pageUrl: "/msk/events/category/jazz",
  },
  {
    id: "val-5",
    category: "warning",
    severity: "info",
    title: "WebSite: SearchAction опционален",
    detail: "Для превью в Search Console рекомендуется явный query-input.",
  },
];
