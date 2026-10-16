/**
 * Новый мастер предложений (фаза 1, TZ-1): чистые определения шагов без зависимостей от UI,
 * чтобы их можно было проверять обычным node-тестом.
 */
import type { OfferFormData, OfferProductType, OfferWizardStepKey } from "./types";

export interface OfferWizardStepDef {
  key: OfferWizardStepKey;
  title: string;
  description: string;
  shortLabel: string;
}

/**
 * Новый мастер (фаза 1, TZ-1): 6 шагов, подписи не зависят от типа предложения.
 * Пока шаги собираются из существующих блоков (см. `getV2StepMembers`); отдельные поля
 * переезжают в следующих PR (категории, «О предложении», цены, расписание).
 */
export const V2_STEPS: OfferWizardStepDef[] = [
  {
    key: "type",
    title: "Что вы хотите предложить семьям?",
    description: "Выберите подходящий вариант. Детали уточним дальше.",
    shortLabel: "Формат",
  },
  {
    key: "about",
    title: "О предложении",
    description: "Название, фото, описание и для кого предложение",
    shortLabel: "О предложении",
  },
  {
    key: "services",
    title: "Услуги и цены",
    description: "Что входит и сколько стоит",
    shortLabel: "Услуги и цены",
  },
  {
    key: "schedule",
    title: "Расписание",
    description: "Когда проходит и как к вам записываются",
    shortLabel: "Расписание",
  },
  {
    key: "terms",
    title: "Условия и контакты",
    description: "Как с вами связаться и условия участия",
    shortLabel: "Контакты",
  },
  {
    key: "review",
    title: "Проверка",
    description: "Проверка и отправка на модерацию",
    shortLabel: "Проверка",
  },
];

export function v2StepDefWithoutKey(key: OfferWizardStepKey): Omit<OfferWizardStepDef, "key"> {
  const def = V2_STEPS.find((step) => step.key === key)!;
  return { title: def.title, description: def.description, shortLabel: def.shortLabel };
}

export const V2_STEP_KEYS: readonly OfferWizardStepKey[] = ["about", "services", "schedule", "terms"];

export function isV2CompositeStepKey(key: OfferWizardStepKey): boolean {
  return V2_STEP_KEYS.includes(key);
}

function isPartyProduct(productType: OfferProductType | null | undefined): boolean {
  return productType === "PARTY_SERVICE" || productType === "PARTY_PACKAGE";
}

/**
 * Из каких существующих шагов собран шаг нового мастера. Порядок = порядок блоков на экране.
 * Пустой список — блок появится в следующих PR (например, расписание праздника).
 */
export function getV2StepMembers(
  key: OfferWizardStepKey,
  data: Pick<OfferFormData, "offerWizardType" | "productType">,
): OfferWizardStepKey[] {
  const isCamp = data.offerWizardType === "CAMP";
  const isParty = isPartyProduct(data.productType);

  switch (key) {
    case "about":
      return isParty ? ["placements", "details", "photo"] : ["details", "photo"];
    case "services":
      return ["price"];
    case "schedule":
      if (isCamp) return ["campSchedule", "accommodation", "bookingMethod"];
      return isParty
        ? ["openingHours", "bookingMethod"]
        : ["conditions", "openingHours", "bookingMethod"];
    case "terms":
      return ["contacts", "paymentTerms"];
    default:
      return [];
  }
}
