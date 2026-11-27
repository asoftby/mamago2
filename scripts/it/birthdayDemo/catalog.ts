import type { PublicationPriceMode, PackageComponentRemovalPolicy, PartyCategory, PartyLocationType } from "@prisma/client";

export const DEMO_PREFIX = "birthday-demo-v1-";
export const demoId = (key: string) => DEMO_PREFIX + key;
export const DEMO_PASSWORD = "BirthdayDemo!2026";
export const CATEGORY_VARIANTS = {
  VENUE: ["Игровая комната", "Творческая студия", "Банкетное пространство"],
  ANIMATOR: ["Аниматор", "Ведущий", "Тематический персонаж"],
  SHOW: ["Научное шоу", "Фокусы", "Мыльные пузыри"],
  MASTER_CLASS: ["Кулинарный мастер-класс", "Творческий мастер-класс", "Научный мастер-класс"],
  CAKE: ["Готовый торт", "Индивидуальный торт", "Капкейки"],
  FOOD: ["Детское меню", "Кейтеринг", "Сладкий стол"],
  DECOR: ["Воздушные шары", "Фотозона", "Тематический декор"],
  PHOTO: ["Фотограф", "Видеооператор", "Фотосессия"],
  PROGRAM: ["Квест", "Игровая программа", "Тематический праздник"],
  OTHER: ["Пиньята", "Аренда оборудования", "Сувениры"],
} satisfies Record<PartyCategory, readonly string[]>;
export type DemoComponent = {
  key: string; category: PartyCategory; title: string; removalPolicy: PackageComponentRemovalPolicy | null;
  removalCreditByn?: number; isOptional?: boolean; archived?: boolean;
};
export type DemoOffer = {
  key: string; title: string; business: number; category: PartyCategory;
  productType: "PARTY_PACKAGE" | "PARTY_SERVICE"; priceMode: PublicationPriceMode; price: number | null;
  location: PartyLocationType; components?: DemoComponent[]; hidden?: boolean; otherCity?: boolean;
  ageMin?: number; minChildren?: number; maxChildren?: number;
};
const component = (key: string, category: PartyCategory, title: string, removalPolicy: PackageComponentRemovalPolicy | null,
  extra: Partial<DemoComponent> = {}): DemoComponent => ({ key, category, title, removalPolicy, ...extra });

export const DEMO_OFFERS: readonly DemoOffer[] = [
  ...Object.entries(CATEGORY_VARIANTS).flatMap(([category, variants]) => variants.map((title, i): DemoOffer => ({
    key: category.toLowerCase() + "-" + (i + 1), title, category: category as PartyCategory, business: i + 1,
    productType: "PARTY_SERVICE", priceMode: i === 1 ? "FROM" : i === 2 && category === "CAKE" ? "ON_REQUEST"
      : i === 2 && (category === "SHOW" || category === "OTHER") ? "FREE" : "EXACT",
    price: i === 2 && category === "CAKE" ? null : i === 2 && (category === "SHOW" || category === "OTHER") ? 0
      : category === "VENUE" ? [250, 350, 1500][i] : [100, 150, 700][i],
    location: category === "VENUE" ? "ON_SITE" : i < 2 ? "BOTH" : "ON_SITE",
    ageMin: i === 2 ? 120 : 36, minChildren: category === "VENUE" && i === 2 ? 15 : 3,
    maxChildren: i === 0 ? 12 : i === 1 ? 20 : 30,
  }))),
  { key: "package-all", title: "А. Всё включено", business: 1, category: "VENUE", productType: "PARTY_PACKAGE",
    priceMode: "EXACT", price: 900, location: "ON_SITE", components: [
      component("hall", "VENUE", "Площадка", "REQUIRED"),
      component("animator", "ANIMATOR", "Аниматор пакета", "REMOVABLE_FIXED_CREDIT", { removalCreditByn: 100 }),
      component("cake", "CAKE", "Торт пакета", "REMOVABLE_NO_REFUND"),
      component("decor", "DECOR", "Декор пакета", "REMOVABLE_QUOTE_REQUIRED"),
      component("photo", "PHOTO", "Фотограф пакета", "REMOVABLE_FIXED_CREDIT", { removalCreditByn: 80 }),
      component("archived", "SHOW", "Архивное шоу — не входит", "REQUIRED", { archived: true }),
    ] },
  { key: "package-flex", title: "Б. Гибкий пакет", business: 2, category: "VENUE", productType: "PARTY_PACKAGE",
    priceMode: "EXACT", price: 500, location: "ON_SITE", components: [
      component("hall", "VENUE", "Площадка", "REQUIRED"),
      component("program", "PROGRAM", "Основная программа", "REMOVABLE_NO_REFUND"),
      component("optional-required", "SHOW", "Опция с обязательным сохранением", "REQUIRED", { isOptional: true }),
      component("legacy", "OTHER", "Старый компонент без правила", null),
    ] },
  { key: "package-home", title: "В. Праздник дома", business: 1, category: "PROGRAM", productType: "PARTY_PACKAGE",
    priceMode: "FROM", price: 350, location: "OFF_SITE", components: [
      component("program", "PROGRAM", "Выездная программа", "REQUIRED"),
      component("animator", "ANIMATOR", "Выездной аниматор", "REMOVABLE_QUOTE_REQUIRED"),
    ] },
  { key: "package-outdoor", title: "Г. Праздник на природе", business: 2, category: "PROGRAM", productType: "PARTY_PACKAGE",
    priceMode: "FROM", price: 450, location: "OFF_SITE", components: [
      component("program", "PROGRAM", "Программа на природе", "REQUIRED"),
      component("food", "FOOD", "Кейтеринг", "REMOVABLE_QUOTE_REQUIRED"),
      component("animator", "ANIMATOR", "Ведущий", "REMOVABLE_NO_REFUND"),
    ] },
  { key: "package-custom", title: "Д. Индивидуальный праздник", business: 3, category: "VENUE", productType: "PARTY_PACKAGE",
    priceMode: "ON_REQUEST", price: null, location: "ON_SITE", components: [
      component("hall", "VENUE", "Площадка", "REQUIRED"),
      component("show", "SHOW", "Индивидуальное шоу", "REMOVABLE_QUOTE_REQUIRED"),
    ] },
  { key: "withdrawn", title: "Снято с публикации — не показывать", business: 1, category: "PHOTO",
    productType: "PARTY_SERVICE", priceMode: "EXACT", price: 99, location: "BOTH", hidden: true },
  { key: "other-city", title: "Исполнитель другого города — не показывать в Минске", business: 3, category: "ANIMATOR",
    productType: "PARTY_SERVICE", priceMode: "EXACT", price: 80, location: "OFF_SITE", otherCity: true },
];

/** Minsk-local dates, independent of the machine timezone; only relative fixture dates roll. */
export function demoDates(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Minsk", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + 14);
  return { partyDate: date.toISOString().slice(0, 10), occupiedFrom: date.toISOString().slice(0, 10) + "T09:00:00Z",
    occupiedTo: date.toISOString().slice(0, 10) + "T11:00:00Z" }; // 12:00–14:00 Minsk
}
