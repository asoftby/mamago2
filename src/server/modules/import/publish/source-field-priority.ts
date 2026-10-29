/**
 * Приоритет источников по полям при слиянии в существующее событие
 * (docs/engineering/telegram-channels-import-spec.md, «Дедупликация», п. 6).
 *
 *   цена, сеансы, ссылка покупки : ABWS > организатор > family.by > агрегатор
 *   описание, возраст, контакты  : организатор > ABWS > family.by > агрегатор
 *   обложка                      : организатор > ABWS > остальные
 *
 * Источник с меньшим приоритетом только заполняет пустые поля; автоматически
 * он ничего непустого не перезаписывает, а расхождение решает редактор.
 * Здесь только ранги и единственное правило, которого не хватало фильтру
 * обновления: описание агрегатора не заменяет непустое описание «по длине».
 */

import { TELEGRAM_CHANNEL_PARSER_KEY } from "../parsers/telegram-channel-constants";

export type ImportSourceKind = "ABWS" | "FAMILY_BY" | "ORGANIZER" | "TELEGRAM_AGGREGATOR" | "OTHER";
export type FieldGroup = "commerce" | "content" | "cover";

export function classifyImportSource(source: {
  parserKey: string | null;
  isOrganizerSource: boolean;
}): ImportSourceKind {
  if (source.isOrganizerSource) return "ORGANIZER";
  if (source.parserKey === "abws-performances-event") return "ABWS";
  if (source.parserKey?.startsWith("family-by-")) return "FAMILY_BY";
  if (source.parserKey === TELEGRAM_CHANNEL_PARSER_KEY) return "TELEGRAM_AGGREGATOR";
  return "OTHER";
}

const RANKS: Record<FieldGroup, Record<ImportSourceKind, number>> = {
  commerce: { ABWS: 4, ORGANIZER: 3, FAMILY_BY: 2, TELEGRAM_AGGREGATOR: 1, OTHER: 2 },
  content: { ORGANIZER: 4, ABWS: 3, FAMILY_BY: 2, TELEGRAM_AGGREGATOR: 1, OTHER: 2 },
  cover: { ORGANIZER: 4, ABWS: 3, FAMILY_BY: 1, TELEGRAM_AGGREGATOR: 1, OTHER: 1 },
};

export function sourcePriority(group: FieldGroup, kind: ImportSourceKind): number {
  return RANKS[group][kind];
}

/**
 * Может ли источник заменить НЕПУСТОЕ значение поля автоматически. Агрегатор
 * не может ни в одной группе; остальные источники сохраняют прежнее поведение.
 */
export function mayOverwriteNonEmpty(_group: FieldGroup, kind: ImportSourceKind): boolean {
  return kind !== "TELEGRAM_AGGREGATOR";
}
