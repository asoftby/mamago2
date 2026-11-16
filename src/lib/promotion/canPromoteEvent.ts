import { ContentStatus } from "@prisma/client";

export type EventPromoteBlockReason = "not-published" | "past";

/**
 * Можно ли продвигать событие из списка бизнеса.
 * Нельзя: публикация не активна (не PUBLISHED) или событие уже прошло
 * (есть дата и она раньше «сейчас»; события без даты не считаются прошедшими —
 * как в админском фильтре «прошедшие»).
 */
export function getEventPromoteBlockReason(
  status: ContentStatus,
  nextOccurrenceAt: Date | string | null | undefined,
  now: Date = new Date(),
): EventPromoteBlockReason | null {
  if (status !== ContentStatus.PUBLISHED) return "not-published";
  if (nextOccurrenceAt && new Date(nextOccurrenceAt).getTime() < now.getTime()) return "past";
  return null;
}

export const EVENT_PROMOTE_BLOCK_TITLE: Record<EventPromoteBlockReason, string> = {
  "not-published": "Публикация не активна",
  past: "Событие уже прошло",
};
