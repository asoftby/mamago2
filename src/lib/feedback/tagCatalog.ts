import {
  sentimentToRepresentativeStars,
  type FeedbackStars,
  type FeedbackTargetType,
  type FeedbackValue,
} from "./model";

/**
 * Initial admin-editable tags (source document pages 2-3).
 * GENERAL tags describe the reviewed object itself and must NEVER be copied to
 * a venue or organizer simply because an event was hosted there.
 *
 * `showFor` holds star values (1–5). Converted from the Feedback 1.0 sentiment
 * sets by the same rule as migration 20261101150000_feedback_stars_foundation:
 * [+1] → [4,5]; [+1,0] → [3,4,5]; [−1,0] → [1,2,3].
 */
export type FeedbackTagScope = "PROGRAM" | "VENUE" | "ORGANIZER" | "GENERAL";
export type PartyCategory =
  | "VENUE" | "ANIMATOR" | "SHOW" | "MASTER_CLASS" | "CAKE" | "FOOD" | "DECOR" | "PHOTO" | "PROGRAM" | "OTHER";
export type StarterFeedbackTag = {
  key: string;
  label: string;
  scope: FeedbackTagScope;
  showFor: readonly FeedbackStars[];
  targetTypes: readonly FeedbackTargetType[];
  /** Party-service chip set; empty or absent = not party-specific. */
  partyCategories?: readonly PartyCategory[];
};

const EVENT = "EVENT" as const;
const PLACE = "PLACE" as const;
const OFFER = "OFFER" as const;

const POSITIVE: readonly FeedbackStars[] = [3, 4, 5];
const TOP: readonly FeedbackStars[] = [4, 5];
const NEGATIVE: readonly FeedbackStars[] = [1, 2, 3];

export const STARTER_FEEDBACK_TAGS: readonly StarterFeedbackTag[] = [
  { key: "kids-delighted", label: "Дети в восторге", scope: "PROGRAM", showFor: POSITIVE, targetTypes: [EVENT,OFFER] },
  { key: "interesting-program", label: "Интересная программа", scope: "PROGRAM", showFor: POSITIVE, targetTypes: [EVENT,OFFER] },
  { key: "would-return", label: "Придём ещё", scope: "GENERAL", showFor: TOP, targetTypes: [EVENT,PLACE,OFFER] },
  { key: "worth-the-price", label: "Стоит своих денег", scope: "PROGRAM", showFor: POSITIVE, targetTypes: [EVENT,OFFER] },
  { key: "great-organization", label: "Отличная организация", scope: "ORGANIZER", showFor: POSITIVE, targetTypes: [EVENT] },
  { key: "friendly-staff", label: "Приятный персонал", scope: "VENUE", showFor: POSITIVE, targetTypes: [EVENT,PLACE,OFFER] },
  { key: "stroller-accessible", label: "Удобно с коляской", scope: "VENUE", showFor: POSITIVE, targetTypes: [EVENT,PLACE] },
  { key: "food-available", label: "Есть где перекусить", scope: "VENUE", showFor: POSITIVE, targetTypes: [EVENT,PLACE] },
  { key: "parking", label: "Удобная парковка", scope: "VENUE", showFor: POSITIVE, targetTypes: [EVENT,PLACE] },
  { key: "clean", label: "Чисто", scope: "VENUE", showFor: POSITIVE, targetTypes: [PLACE] },
  { key: "boring", label: "Скучно", scope: "PROGRAM", showFor: NEGATIVE, targetTypes: [EVENT,OFFER] },
  { key: "age-mismatch", label: "Не для этого возраста", scope: "PROGRAM", showFor: NEGATIVE, targetTypes: [EVENT,OFFER] },
  { key: "expensive", label: "Дорого", scope: "GENERAL", showFor: NEGATIVE, targetTypes: [EVENT,PLACE,OFFER] },
  { key: "description-mismatch", label: "Не соответствует описанию", scope: "PROGRAM", showFor: NEGATIVE, targetTypes: [EVENT,OFFER] },
  { key: "poor-organization", label: "Плохая организация", scope: "ORGANIZER", showFor: NEGATIVE, targetTypes: [EVENT] },
  { key: "late-start", label: "Задержка начала", scope: "ORGANIZER", showFor: NEGATIVE, targetTypes: [EVENT] },
  { key: "crowded", label: "Тесно, много людей", scope: "VENUE", showFor: NEGATIVE, targetTypes: [EVENT,PLACE] },
  { key: "inconvenient-access", label: "Неудобно добираться", scope: "VENUE", showFor: NEGATIVE, targetTypes: [EVENT,PLACE] },
  { key: "dirty", label: "Грязно", scope: "VENUE", showFor: NEGATIVE, targetTypes: [PLACE] },
  { key: "noisy", label: "Шумно", scope: "VENUE", showFor: NEGATIVE, targetTypes: [EVENT,PLACE] },
];

/**
 * Chips offered for a star rating. A tag with party categories is offered only
 * for a party service of one of those categories; a tag without them is general.
 */
export function availableFeedbackTags(
  target: FeedbackTargetType,
  stars: FeedbackStars,
  catalog: readonly StarterFeedbackTag[] = STARTER_FEEDBACK_TAGS,
  partyCategory?: PartyCategory | null,
): readonly StarterFeedbackTag[] {
  if (target === "ARTICLE" || target === "NEWS" || target === "ROUTE" || target === "BUSINESS") return [];
  return catalog.filter((tag) => {
    if (!tag.targetTypes.includes(target) || !tag.showFor.includes(stars)) return false;
    const party = tag.partyCategories ?? [];
    return party.length === 0 || (partyCategory != null && party.includes(partyCategory));
  });
}

/** Legacy emoji UI (SENTIMENT3): chips via the representative star of the sentiment. */
export function availableFeedbackTagsForSentiment(
  target: FeedbackTargetType,
  value: FeedbackValue,
  catalog: readonly StarterFeedbackTag[] = STARTER_FEEDBACK_TAGS,
): readonly StarterFeedbackTag[] {
  return availableFeedbackTags(target, sentimentToRepresentativeStars(value), catalog);
}
