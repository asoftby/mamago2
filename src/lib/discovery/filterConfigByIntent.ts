import type { Intent } from "@/lib/intent";
import type { FilterUi } from "@/lib/discovery/filterDefinitionTypes";

/** Опция в группе secondary-фильтров */
export type SecondaryFilterOption = {
  id: string;
  label: string;
};

/** Одна группа (только intent-specific; primary в URL отдельно: age, from, metro…) */
export type SecondaryFilterGroup =
  | {
      id: string;
      label: string;
      kind: "single";
      ui?: FilterUi;
      showTitle?: boolean;
      options: SecondaryFilterOption[];
    }
  | {
      id: string;
      label: string;
      kind: "multiple";
      ui?: FilterUi;
      showTitle?: boolean;
      options: SecondaryFilterOption[];
    }
  | {
      id: string;
      label: string;
      kind: "boolean";
      ui?: FilterUi;
      showTitle?: boolean;
      trueLabel: string;
      falseLabel?: string;
    };

/**
 * Secondary filters по intent (занятия в коде = `classes`, в ТЗ — zanyatiya).
 * Primary (локация, дата, возраст) не дублируются здесь.
 */
export const filterConfigByIntent: Record<Intent, SecondaryFilterGroup[]> = {
  kuda: [
    {
      id: "venue",
      label: "Где",
      kind: "single",
      options: [
        { id: "indoor", label: "В помещении" },
        { id: "outdoor", label: "На улице" },
      ],
    },
    {
      id: "price",
      label: "Цена",
      kind: "single",
      options: [
        { id: "free", label: "Бесплатно" },
        { id: "paid", label: "Платно" },
      ],
    },
    {
      id: "open_now",
      label: "Сейчас",
      kind: "boolean",
      trueLabel: "Сейчас открыто",
    },
    {
      id: "free_only",
      label: "Только бесплатно",
      kind: "boolean",
      ui: "switcher",
      showTitle: false,
      trueLabel: "Только бесплатно",
    },
    {
      id: "activity_type",
      label: "Как проходит событие",
      kind: "multiple",
      options: [
        { id: "calm_relaxed", label: "Спокойно и расслабленно" },
        { id: "educational", label: "Познавательно" },
        { id: "playful", label: "Игриво" },
        { id: "active_energetic", label: "Активно и энергично" },
        { id: "shows", label: "Спектакли" },
        { id: "exhibitions", label: "Выставки" },
        { id: "parks", label: "Парки" },
      ],
    },
  ],
  classes: [
    {
      id: "duration",
      label: "Длительность",
      kind: "single",
      options: [
        { id: "short", label: "До 45 мин" },
        { id: "medium", label: "45–90 мин" },
        { id: "long", label: "90+ мин" },
      ],
    },
    {
      id: "format",
      label: "Формат",
      kind: "single",
      options: [
        { id: "once", label: "Разовое" },
        { id: "course", label: "Курс" },
      ],
    },
    {
      id: "trial",
      label: "Пробное",
      kind: "boolean",
      trueLabel: "Есть пробное занятие",
    },
  ],
  birthday: [
    {
      id: "service_type",
      label: "Тип услуги",
      kind: "single",
      options: [
        { id: "venue", label: "Площадка" },
        { id: "animators", label: "Аниматоры" },
        { id: "turnkey", label: "Под ключ" },
      ],
    },
    {
      id: "budget",
      label: "Бюджет",
      kind: "single",
      options: [
        { id: "low", label: "До 300 BYN" },
        { id: "mid", label: "300–700 BYN" },
        { id: "high", label: "700+ BYN" },
      ],
    },
    {
      id: "includes",
      label: "Включено",
      kind: "multiple",
      options: [
        { id: "food", label: "Еда" },
        { id: "decor", label: "Декор" },
        { id: "show", label: "Шоу-программа" },
      ],
    },
  ],
  routes: [
    {
      id: "duration",
      label: "Длительность",
      kind: "single",
      options: [
        { id: "short", label: "До 2 ч" },
        { id: "half_day", label: "Полдня" },
        { id: "full_day", label: "Целый день" },
      ],
    },
    {
      id: "format",
      label: "Формат",
      kind: "single",
      options: [
        { id: "walk", label: "Пешком" },
        { id: "car", label: "На авто" },
        { id: "mixed", label: "Смешанный" },
      ],
    },
    {
      id: "stroller",
      label: "С коляской",
      kind: "boolean",
      trueLabel: "Удобно с коляской",
    },
  ],
};

/** Alias для документации / внешних ссылок (zanyatiya → classes) */
export const filterConfigIntentAlias = {
  zanyatiya: "classes" as const,
} as const;
