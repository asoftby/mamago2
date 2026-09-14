/**
 * Parser definitions — source of truth для UI форм.
 * Используется в форме создания/редактирования ImportSource.
 *
 */

export interface ParserDefinition {
  key: string;
  label: string;
  entityType: "PLACE" | "EVENT";
  description?: string;
  config?: {
    maxDatePages?: number;
  };
}

export const PARSER_DEFINITIONS: ParserDefinition[] = [
  // ── Production parsers ───────────────────────────────────────────────────
  {
    key: "family-by-place",
    label: "family.by — Места (один листинг)",
    entityType: "PLACE",
    description: "Парсит одну listing-страницу family.by /spravka/. Укажите конкретный URL категории.",
  },
  {
    key: "family-by-playcenter-place",
    label: "family.by — Игровые центры",
    entityType: "PLACE",
    description: "Парсит категорию /spravka/dosug/playcenter/ — игровые и развлекательные центры Минска.",
  },
  {
    key: "family-by-directory-place",
    label: "family.by — Справочник мест (весь /spravka/)",
    entityType: "PLACE",
    description: "Обходит весь справочник family.by начиная с /spravka/. Лимиты: 80 страниц, 100 записей.",
  },
  {
    key: "family-by-afisha-event",
    label: "family.by — Афиша событий",
    entityType: "EVENT",
    description: "Парсит афишу family.by (/afisha/) — события, выставки, концерты для детей и семей.",
    config: {
      maxDatePages: 5,
    },
  },
  {
    key: "abws-performances-event",
    label: "24afisha.by (ABWS) — Мероприятия и сеансы",
    entityType: "EVENT",
    description:
      "JSON API webgate.24guru.by/api/v3/sync/data/performances. Требует ABWS_KEY в окружении. " +
      "Фаза 1: только одноплощадочные мероприятия публикуются; многоплощадочные сохраняются как " +
      "pendingMultiVenue (см. docs/imports/abws-phase1-spec.md).",
  },
  // ── Real parsers (добавлять сюда) ────────────────────────────────────────
  // {
  //   key: "afisha-by-place",
  //   label: "Afisha.by — Места",
  //   entityType: "PLACE",
  //   description: "Парсер мест с afisha.by",
  // },
];

export function getProductionParsers(): ParserDefinition[] {
  return PARSER_DEFINITIONS;
}

export function getAllParsers(): ParserDefinition[] {
  return PARSER_DEFINITIONS;
}

export function getParserDefinition(key: string): ParserDefinition | undefined {
  return PARSER_DEFINITIONS.find((p) => p.key === key);
}
