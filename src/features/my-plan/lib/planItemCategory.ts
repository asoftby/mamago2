/**
 * Категории пунктов плана, добавленных вручную. Ключ хранится в PlanItem.category.
 * Пользователь категорию при вводе не выбирает: она определяется по названию
 * (detectPlanItemCategory), а неверную догадку можно поправить тапом по иконке.
 */
export const PLAN_ITEM_CATEGORY_KEYS = [
  "health",
  "sport",
  "school",
  "clubs",
  "shopping",
  "home",
  "party",
  "trip",
  "note",
] as const;

export type PlanItemCategoryKey = (typeof PLAN_ITEM_CATEGORY_KEYS)[number];

export const DEFAULT_PLAN_ITEM_CATEGORY: PlanItemCategoryKey = "note";

export const PLAN_ITEM_CATEGORY_LABELS: Record<PlanItemCategoryKey, string> = {
  health: "Здоровье",
  sport: "Спорт",
  school: "Школа",
  clubs: "Кружки",
  shopping: "Покупки",
  home: "Дом",
  party: "Праздник",
  trip: "Поездка",
  note: "Заметка",
};

export function isPlanItemCategoryKey(value: unknown): value is PlanItemCategoryKey {
  return typeof value === "string" && (PLAN_ITEM_CATEGORY_KEYS as readonly string[]).includes(value);
}

/**
 * Словарь «основ слов»: слово названия подходит, если начинается с основы.
 * `exact` — короткие слова, которые должны совпасть целиком (иначе «бег» ловит «бегемот»).
 * Порядок категорий = приоритет при совпадении на одном слове; в тексте побеждает самое раннее слово.
 */
const DICTIONARY: ReadonlyArray<{
  key: Exclude<PlanItemCategoryKey, "note">;
  stems: readonly string[];
  exact?: readonly string[];
}> = [
  {
    key: "health",
    stems: [
      "врач", "терапевт", "стоматолог", "педиатр", "анализ", "прививк", "поликлиник", "больниц",
      "окулист", "невролог", "ортопед", "хирург", "лекарств", "медосмотр", "аптек", "массаж",
      "логопед", "дантист", "зубн", "кардиолог", "диспансеризац",
    ],
    exact: ["лор", "узи", "экг", "мрт", "зуб", "зубы"],
  },
  {
    key: "sport",
    stems: [
      "тренировк", "бассейн", "футбол", "секци", "гимнастик", "каток", "плаван", "хоккей",
      "баскетбол", "волейбол", "теннис", "карате", "дзюдо", "борьб", "лыж", "самбо", "фитнес",
      "зарядк", "велосипед", "самокат", "ролик",
    ],
    exact: ["йога", "бег", "бегом", "спорт"],
  },
  {
    key: "school",
    stems: [
      "школ", "урок", "учител", "домашк", "физкультур", "картон", "контрольн", "экзамен",
      "классн", "родительск", "собрани", "олимпиад", "тетрад", "портфел", "гдз", "лицей", "гимнази",
    ],
    exact: ["дз", "класс"],
  },
  {
    key: "clubs",
    stems: [
      "кружок", "кружк", "студи", "рисован", "танц", "музык", "вокал", "шахмат", "робототехник",
      "лепк", "английск", "репетитор", "занятие", "занятия", "курс", "хореограф", "пение",
      "программирован", "фортепиано", "скрипк", "театральн", "рукоделие",
    ],
  },
  {
    key: "shopping",
    stems: [
      "купить", "покупк", "магазин", "заказ", "продукт", "одежд", "обув", "ботинк", "куртк",
      "маркетплейс", "супермаркет", "рынок", "кроссовк", "канцеляр", "ozon", "wildberries",
    ],
  },
  {
    key: "home",
    stems: [
      "уборк", "ремонт", "стирк", "готовить", "приготов", "ужин", "обед", "завтрак", "сантехник",
      "квартир", "коммунальн", "счетчик", "посуд", "мусор", "полить", "цветы", "клининг",
    ],
    exact: ["дом", "дома", "домой", "мастер"],
  },
  {
    key: "party",
    stems: [
      "праздник", "утренник", "именин", "свадьб", "юбилей", "торт", "подарок", "подарк",
      "вечеринк", "поздравл", "выпускн", "новогодн", "елка", "елку", "банкет", "аниматор",
    ],
    exact: ["др"],
  },
  {
    key: "trip",
    stems: [
      "поездк", "путешеств", "отпуск", "поезд", "билет", "самолет", "рейс", "вокзал", "аэропорт",
      "дач", "виза", "визу", "отель", "гостиниц", "командировк", "экскурс", "лагерь", "санатори",
      "каникул", "паспорт", "чемодан",
    ],
    exact: ["море", "дача"],
  },
];

/** Фразы из нескольких слов — проверяются по подстроке раньше пословного разбора. */
const PHRASES: ReadonlyArray<{ key: Exclude<PlanItemCategoryKey, "note">; phrases: readonly string[] }> = [
  { key: "party", phrases: ["день рождения", "дня рождения", "дню рождения", "день варенья"] },
  { key: "school", phrases: ["родительское собрание"] },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е");
}

/** Категория по ключевым словам названия; ничего не нашли → «заметка». */
export function detectPlanItemCategory(title: string | null | undefined): PlanItemCategoryKey {
  const text = normalize(title ?? "").trim();
  if (!text) return DEFAULT_PLAN_ITEM_CATEGORY;

  const words = text.split(/[^a-zа-я0-9]+/).filter(Boolean);
  for (const word of words) {
    for (const entry of DICTIONARY) {
      if (entry.exact?.includes(word)) return entry.key;
      if (entry.stems.some((stem) => word.startsWith(normalize(stem)))) return entry.key;
    }
  }
  for (const entry of PHRASES) {
    if (entry.phrases.some((phrase) => text.includes(phrase))) return entry.key;
  }
  return DEFAULT_PLAN_ITEM_CATEGORY;
}

/** Сохранённая категория, а для старых пунктов без неё — автоопределение по названию. */
export function resolvePlanItemCategory(
  category: string | null | undefined,
  title: string | null | undefined,
): PlanItemCategoryKey {
  return isPlanItemCategoryKey(category) ? category : detectPlanItemCategory(title);
}
