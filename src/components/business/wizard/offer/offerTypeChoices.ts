import type { OfferFormData, OfferProductType } from "./types";

export type OfferCreationCategoryKey = "place" | "classes" | "parties" | "camps";

export interface OfferCreationOption {
  value: OfferProductType;
  label: string;
  description: string;
}

export interface OfferCreationCategory {
  key: OfferCreationCategoryKey;
  label: string;
  description: string;
  question?: string;
  options: readonly OfferCreationOption[];
}

/**
 * The four categories are a navigation aid, not persisted OfferProductTypes.
 * Keep the existing six product types for wizard steps, API contracts and edits.
 */
export const OFFER_CREATION_CATEGORIES: readonly OfferCreationCategory[] = [
  {
    key: "place",
    label: "Посещение места",
    description: "Игровая комната, музей, батутный центр и другие места для посещения.",
    options: [
      {
        value: "PLACE_VISIT",
        label: "Посещение места",
        description: "Режим работы, билеты и условия посещения укажете дальше.",
      },
    ],
  },
  {
    key: "classes",
    label: "Занятия и мастер-классы",
    description: "Разовые занятия, кружки, секции и курсы.",
    question: "Как проходят занятия?",
    options: [
      {
        value: "ONE_TIME_ACTIVITY",
        label: "Разовое занятие",
        description: "Мастер-класс, пробное занятие или отдельная встреча.",
      },
      {
        value: "REGULAR_ACTIVITY",
        label: "Регулярные занятия",
        description: "Кружок, секция или курс с расписанием.",
      },
    ],
  },
  {
    key: "parties",
    label: "Дни рождения и праздники",
    description: "Аниматоры, шоу, торты и готовые программы.",
    question: "Что вы предлагаете?",
    options: [
      {
        value: "PARTY_SERVICE",
        label: "Отдельную услугу",
        description: "Аниматор, фотограф, торт, декор, шоу или площадка.",
      },
      {
        value: "PARTY_PACKAGE",
        label: "Готовую программу праздника",
        description: "Праздник с несколькими услугами в одном пакете.",
      },
    ],
  },
  {
    key: "camps",
    label: "Лагеря и каникулы",
    description: "Городские лагеря, смены и программы на каникулы.",
    options: [
      {
        value: "CAMP",
        label: "Лагерь или программа",
        description: "Одну или несколько смен можно добавить в расписании.",
      },
    ],
  },
];

export function getOfferCreationCategory(
  productType: OfferProductType | null,
): OfferCreationCategory | null {
  if (!productType) return null;
  return OFFER_CREATION_CATEGORIES.find((category) =>
    category.options.some((option) => option.value === productType),
  ) ?? null;
}

type OfferTypeSelection = Pick<
  OfferFormData,
  "productType" | "offerWizardType" | "requestedPlacements" | "offerKind" | "durationType" | "intent"
>;

/** Exact legacy mapping: selection UI must not change backend behavior. */
const OFFER_TYPE_SELECTIONS: Record<OfferProductType, OfferTypeSelection> = {
  PLACE_VISIT: {
    productType: "PLACE_VISIT",
    offerWizardType: "SINGLE",
    requestedPlacements: ["WHERE_TO_GO"],
    offerKind: "service",
    durationType: null,
    intent: "куда_пойти",
  },
  ONE_TIME_ACTIVITY: {
    productType: "ONE_TIME_ACTIVITY",
    offerWizardType: "SINGLE",
    requestedPlacements: ["WHERE_TO_GO"],
    offerKind: "course",
    durationType: "single",
    intent: "куда_пойти",
  },
  REGULAR_ACTIVITY: {
    productType: "REGULAR_ACTIVITY",
    offerWizardType: "REGULAR",
    requestedPlacements: ["CLASSES"],
    offerKind: "course",
    durationType: "recurring",
    intent: "занятия",
  },
  CAMP: {
    productType: "CAMP",
    offerWizardType: "CAMP",
    requestedPlacements: ["CAMPS"],
    offerKind: "course",
    durationType: "camp",
    intent: "занятия",
  },
  PARTY_SERVICE: {
    productType: "PARTY_SERVICE",
    offerWizardType: "SINGLE",
    requestedPlacements: ["BIRTHDAY"],
    offerKind: "service",
    durationType: null,
    intent: "день_рождения",
  },
  PARTY_PACKAGE: {
    productType: "PARTY_PACKAGE",
    offerWizardType: "SINGLE",
    requestedPlacements: ["BIRTHDAY"],
    offerKind: "birthday",
    durationType: null,
    intent: "день_рождения",
  },
};

export function getOfferTypeSelection(productType: OfferProductType): OfferTypeSelection {
  return OFFER_TYPE_SELECTIONS[productType];
}
