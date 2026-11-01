import type { FeedbackTargetType, FeedbackValue } from "./model";

/**
 * Initial admin-editable tags (source document pages 2-3).
 * GENERAL tags describe the reviewed object itself and must NEVER be copied to
 * a venue or organizer simply because an event was hosted there.
 */
export type FeedbackTagScope = "PROGRAM" | "VENUE" | "ORGANIZER" | "GENERAL";
export type StarterFeedbackTag = {
  key: string;
  label: string;
  scope: FeedbackTagScope;
  showFor: readonly FeedbackValue[];
  targetTypes: readonly FeedbackTargetType[];
};

const EVENT = "EVENT" as const;
const PLACE = "PLACE" as const;
const OFFER = "OFFER" as const;

export const STARTER_FEEDBACK_TAGS: readonly StarterFeedbackTag[] = [
  { key: "kids-delighted", label: "Дети в восторге", scope: "PROGRAM", showFor: [1,0], targetTypes: [EVENT,OFFER] },
  { key: "interesting-program", label: "Интересная программа", scope: "PROGRAM", showFor: [1,0], targetTypes: [EVENT,OFFER] },
  { key: "would-return", label: "Придём ещё", scope: "GENERAL", showFor: [1], targetTypes: [EVENT,PLACE,OFFER] },
  { key: "worth-the-price", label: "Стоит своих денег", scope: "PROGRAM", showFor: [1,0], targetTypes: [EVENT,OFFER] },
  { key: "great-organization", label: "Отличная организация", scope: "ORGANIZER", showFor: [1,0], targetTypes: [EVENT] },
  { key: "friendly-staff", label: "Приятный персонал", scope: "VENUE", showFor: [1,0], targetTypes: [EVENT,PLACE,OFFER] },
  { key: "stroller-accessible", label: "Удобно с коляской", scope: "VENUE", showFor: [1,0], targetTypes: [EVENT,PLACE] },
  { key: "food-available", label: "Есть где перекусить", scope: "VENUE", showFor: [1,0], targetTypes: [EVENT,PLACE] },
  { key: "parking", label: "Удобная парковка", scope: "VENUE", showFor: [1,0], targetTypes: [EVENT,PLACE] },
  { key: "clean", label: "Чисто", scope: "VENUE", showFor: [1,0], targetTypes: [PLACE] },
  { key: "boring", label: "Скучно", scope: "PROGRAM", showFor: [-1,0], targetTypes: [EVENT,OFFER] },
  { key: "age-mismatch", label: "Не для этого возраста", scope: "PROGRAM", showFor: [-1,0], targetTypes: [EVENT,OFFER] },
  { key: "expensive", label: "Дорого", scope: "GENERAL", showFor: [-1,0], targetTypes: [EVENT,PLACE,OFFER] },
  { key: "description-mismatch", label: "Не соответствует описанию", scope: "PROGRAM", showFor: [-1,0], targetTypes: [EVENT,OFFER] },
  { key: "poor-organization", label: "Плохая организация", scope: "ORGANIZER", showFor: [-1,0], targetTypes: [EVENT] },
  { key: "late-start", label: "Задержка начала", scope: "ORGANIZER", showFor: [-1,0], targetTypes: [EVENT] },
  { key: "crowded", label: "Тесно, много людей", scope: "VENUE", showFor: [-1,0], targetTypes: [EVENT,PLACE] },
  { key: "inconvenient-access", label: "Неудобно добираться", scope: "VENUE", showFor: [-1,0], targetTypes: [EVENT,PLACE] },
  { key: "dirty", label: "Грязно", scope: "VENUE", showFor: [-1,0], targetTypes: [PLACE] },
  { key: "noisy", label: "Шумно", scope: "VENUE", showFor: [-1,0], targetTypes: [EVENT,PLACE] },
];

export function availableFeedbackTags(
  target: FeedbackTargetType,
  value: FeedbackValue,
  catalog: readonly StarterFeedbackTag[] = STARTER_FEEDBACK_TAGS,
): readonly StarterFeedbackTag[] {
  if (target === "ARTICLE" || target === "NEWS" || target === "ROUTE") return [];
  return catalog.filter((tag) => tag.targetTypes.includes(target) && tag.showFor.includes(value));
}
