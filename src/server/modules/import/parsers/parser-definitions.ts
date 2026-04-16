/**
 * Parser definitions — source of truth для UI форм.
 * Используется в форме создания/редактирования ImportSource.
 *
 * devOnly: true → не показывать в обычном admin UI.
 */

export interface ParserDefinition {
  key: string;
  label: string;
  entityType: "PLACE" | "EVENT";
  description?: string;
  devOnly?: boolean;
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
    devOnly: false,
  },
  {
    key: "family-by-playcenter-place",
    label: "family.by — Игровые центры",
    entityType: "PLACE",
    description: "Парсит категорию /spravka/dosug/playcenter/ — игровые и развлекательные центры Минска.",
    devOnly: false,
  },
  {
    key: "family-by-directory-place",
    label: "family.by — Справочник мест (весь /spravka/)",
    entityType: "PLACE",
    description: "Обходит весь справочник family.by начиная с /spravka/. Лимиты: 80 страниц, 100 записей.",
    devOnly: false,
  },
  {
    key: "family-by-afisha-event",
    label: "family.by — Афиша событий",
    entityType: "EVENT",
    description: "Парсит афишу family.by (/afisha/) — события, выставки, концерты для детей и семей.",
    devOnly: false,
    config: {
      maxDatePages: 5,
    },
  },
  // ── Dev-only (mock) ──────────────────────────────────────────────────────
  {
    key: "mock-place",
    label: "Mock Place Parser (dev)",
    entityType: "PLACE",
    description: "Статичные тестовые данные для PLACE pipeline",
    devOnly: true,
  },
  {
    key: "mock-event",
    label: "Mock Event Parser (dev)",
    entityType: "EVENT",
    description: "Статичные тестовые данные для EVENT pipeline",
    devOnly: true,
  },
  // ── Real parsers (добавлять сюда) ────────────────────────────────────────
  // {
  //   key: "afisha-by-place",
  //   label: "Afisha.by — Места",
  //   entityType: "PLACE",
  //   description: "Парсер мест с afisha.by",
  // },
];

/** Только production-ready парсеры (без devOnly) */
export function getProductionParsers(): ParserDefinition[] {
  return PARSER_DEFINITIONS.filter((p) => !p.devOnly);
}

/** Все парсеры включая dev */
export function getAllParsers(): ParserDefinition[] {
  return PARSER_DEFINITIONS;
}

export function getParserDefinition(key: string): ParserDefinition | undefined {
  return PARSER_DEFINITIONS.find((p) => p.key === key);
}
