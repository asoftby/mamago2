import { ContentStatus } from "@prisma/client";
import type { EventTemporalState } from "@/lib/events/eventTemporalState";

export type EventPromoteBlockReason = "not-published" | "past";

/**
 * Можно ли продвигать событие из списка бизнеса.
 * Нельзя: публикация не активна (не PUBLISHED) или событие уже прошло.
 *
 * «Прошло» определяется ТОЛЬКО сессионным состоянием (`getEventTemporalState`
 * по неотозванным сеансам): закэшированный `nextOccurrenceAt` для событий с
 * несколькими датами устаревает после первого сеанса и дал бы ложную блокировку.
 * Если состояние не передано (UNKNOWN/undefined), событие прошедшим не считается.
 */
export function getEventPromoteBlockReason(
  status: ContentStatus,
  temporalState?: EventTemporalState | null,
): EventPromoteBlockReason | null {
  if (status !== ContentStatus.PUBLISHED) return "not-published";
  if (temporalState === "PAST") return "past";
  return null;
}

export const EVENT_PROMOTE_BLOCK_TITLE: Record<EventPromoteBlockReason, string> = {
  "not-published": "Публикация не активна",
  past: "Событие уже прошло",
};
