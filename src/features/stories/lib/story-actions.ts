import type { StoryItem, StoryItemType } from "../types/story";

export type StoryAction = {
  label: string;
  href: (item: StoryItem) => string | null | undefined;
  variant: "primary" | "secondary";
  isAvailable?: (item: StoryItem) => boolean;
};

export type ResolvedStoryAction = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

const hasHref = (item: StoryItem) => Boolean(item.href);
const toHref = (item: StoryItem) => item.href;

/**
 * Per-type action registry for the story modal's actions slot.
 * Add a new StoryItemType here — the Record type forces every case to be
 * covered, and story-actions.test.ts asserts it at runtime too.
 *
 * Labels are placeholders — review before shipping, they go live on every
 * story of that type at once.
 */
export const STORY_ACTIONS: Record<StoryItemType, StoryAction[]> = {
  event: [
    { label: "Подробнее о событии", href: toHref, variant: "primary", isAvailable: hasHref },
  ],
  place: [
    { label: "Смотреть место", href: toHref, variant: "primary", isAvailable: hasHref },
  ],
  offer: [
    { label: "Подробнее об акции", href: toHref, variant: "primary", isAvailable: hasHref },
  ],
  "breaking-news": [
    { label: "Читать статью", href: toHref, variant: "primary", isAvailable: hasHref },
  ],
  route: [
    { label: "Смотреть маршрут", href: toHref, variant: "primary", isAvailable: hasHref },
  ],
  story: [
    { label: "Подробнее", href: toHref, variant: "primary", isAvailable: hasHref },
  ],
};

/**
 * Resolves the up-to-2 actions to render for one story item: filters by
 * isAvailable + a resolvable href, orders primary before secondary, and — if
 * only one action survives — forces it to primary/full-width regardless of
 * its declared variant.
 */
export function resolveStoryActions(item: StoryItem): ResolvedStoryAction[] {
  const type = item.type ?? "story";
  const candidates = STORY_ACTIONS[type] ?? [];

  const resolved: ResolvedStoryAction[] = [];
  for (const action of candidates) {
    if (action.isAvailable && !action.isAvailable(item)) continue;
    const href = action.href(item);
    if (!href) continue;
    resolved.push({ label: action.label, href, variant: action.variant });
  }

  const ordered = [
    ...resolved.filter((a) => a.variant === "primary"),
    ...resolved.filter((a) => a.variant === "secondary"),
  ].slice(0, 2);

  if (ordered.length === 1) {
    return [{ ...ordered[0], variant: "primary" }];
  }
  return ordered;
}
