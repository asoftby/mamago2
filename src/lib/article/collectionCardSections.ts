import type { OfferPageData } from "@/lib/offer/offerPageTypes";
import type { OfferProductType } from "@/lib/offers/offer-types/registry";

export type CollectionCardSection = { id: string; title: string; lines: string[] };
export function collectionOfferTypeLabel(productType: OfferProductType | null | undefined, legacyType: OfferPageData["offerType"]): string {
  switch (productType) {
    case "PLACE_VISIT": return "Посещение места";
    case "ONE_TIME_ACTIVITY": return "Занятие";
    case "REGULAR_ACTIVITY": return "Занятия";
    case "CAMP": return "Лагерь";
    case "PARTY_SERVICE": return "Услуга для праздника";
    case "PARTY_PACKAGE": return "Праздник под ключ";
    default: return legacyType === "CAMP" ? "Лагерь" : legacyType === "REGULAR" ? "Программа" : "Предложение";
  }
}

const MAX_SECTIONS = 4; // Including the description.
const clean = (text: unknown): string | null => {
  if (typeof text !== "string") return null;
  const value = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return value || null;
};
const section = (id: string, title: string, values: unknown[]): CollectionCardSection | null => {
  const lines = [...new Set(values.map(clean).filter((v): v is string => v !== null))].slice(0, 8);
  return lines.length ? { id, title, lines } : null;
};
const scheduleLines = (page: OfferPageData) => (page.schedule?.items ?? []).slice(0, 5).map((x) =>
  [x.title || x.groupName, [x.days, x.time].filter(Boolean).join(" "), [x.dateFrom, x.dateTo].filter(Boolean).join(" — "), x.duration]
    .filter(Boolean).join(" · "),
);

/** Canonical offer detail data -> compact editorial accordions; no empty or invented sections. */
export function buildCollectionOfferSections(page: OfferPageData, productType: OfferProductType | null | undefined, packageParts: readonly { title: string; isOptional: boolean }[] = []): CollectionCardSection[] {
  const accommodation = page.accommodation;
  // FAQ answers are not automatically contractual booking conditions.
  const conditions = [page.cta.instructions];
  const program = (page.perks ?? []).map((p) => [p.stat, p.label].filter(Boolean).join(" · "));
  const pricing = (page.pricing.options ?? []).map((p) => [p.title, p.price, p.description].filter(Boolean).join(" · "));
  const shifts = (page.schedule?.items ?? []).slice(0, 5).map((s) =>
    [s.title, [s.dateFrom, s.dateTo].filter(Boolean).join(" — "), s.price, s.spotsLeft != null ? `Осталось мест: ${s.spotsLeft}` : null].filter(Boolean).join(" · "),
  );
  const sections: Array<CollectionCardSection | null> = [];
  switch (productType) {
    case "ONE_TIME_ACTIVITY":
    case "REGULAR_ACTIVITY":
      sections.push(section("schedule", "Расписание", scheduleLines(page)));
      sections.push(section("program", "Программа", [...program, ...(page.daySchedule ?? []).map((d) => [d.time, d.title].filter(Boolean).join(" · "))]));
      sections.push(section("terms", "Условия записи", conditions));
      break;
    case "PARTY_PACKAGE":
    case "PARTY_SERVICE":
      sections.push(section("included", "Что входит", [...packageParts.map((p) => `${p.title}${p.isOptional ? " (дополнительно)" : ""}`), ...program]));
      sections.push(section("packages", "Пакеты и цены", pricing));
      sections.push(section("terms", "Условия заказа", conditions));
      break;
    case "CAMP":
      sections.push(section("shifts", "Смены", shifts));
      sections.push(section("accommodation", "Проживание и питание", [accommodation?.type, accommodation?.address, accommodation?.rooms, accommodation?.conditions, accommodation?.mealInfo]));
      sections.push(section("features", "Особенности", program));
      sections.push(section("bring", "Что взять с собой", [accommodation?.whatToBring]));
      break;
    case "PLACE_VISIT":
      sections.push(section("hours", "Режим работы", [...(page.openingHours?.lines ?? []), ...(page.openingHours?.closedDates ?? [])]));
      sections.push(section("terms", "Условия посещения", conditions));
      break;
    default:
      // Legacy offers: use proven source data, not a guessed offer category.
      sections.push(section("schedule", "Расписание", scheduleLines(page)));
      sections.push(section("terms", "Условия участия", conditions));
  }
  return sections.filter((s): s is CollectionCardSection => s !== null).slice(0, MAX_SECTIONS - 1);
}
