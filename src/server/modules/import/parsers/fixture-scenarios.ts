
/**
 * Dev/test fixture scenarios для ручной проверки import pipeline.
 *
 * Использование:
 *   1. Создать ImportSource с parserKey = "mock-place" или "mock-event"
 *   2. Запустить import run через /admin/import/sources
 *   3. Проверить результаты в /admin/import/review
 *
 * Сценарии покрывают типовые happy path и failure cases.
 * Не требуют внешних зависимостей — всё статично.
 */

// ── PLACE scenarios ───────────────────────────────────────────────────────────

/**
 * PLACE-1: CREATE_NEW — полные данные, все поля маппятся.
 * Ожидаемый результат: normalizeStatus=SUCCESS, qualityScore≈0.9,
 * matchStatus=NO_MATCH, suggestedAction=CREATE_NEW.
 */
export const PLACE_CREATE_FULL = {
  externalId: "fixture-place-create-001",
  sourceUrl: "https://fixture.test/places/cafe-full",
  rawPayload: {
    name: "Кафе Тест Полное",
    shortDescription: "Тестовое кафе с полными данными для проверки CREATE_NEW",
    description: "Полное описание тестового кафе. Детское меню, игровая зона, парковка.",
    address: "ул. Тестовая, 1, Минск",
    city: "Минск",
    lat: 53.9045,
    lng: 27.5615,
    phone: "+375291234567",
    website: "https://cafe-test-full.by",
    categories: ["кафе", "семейный отдых"],
    images: ["https://fixture.test/img/cafe1.jpg"],
    openingHours: "Пн-Пт 9:00-22:00",
  },
};

/**
 * PLACE-2: UPDATE_EXISTING — минимальные данные, похожи на существующий Place.
 * Для воспроизведения: нужен Place с website "cafe-test-update.by" в БД.
 * Ожидаемый результат: matchStatus=MATCHED, suggestedAction=UPDATE_EXISTING.
 */
export const PLACE_UPDATE_EXISTING = {
  externalId: "fixture-place-update-001",
  sourceUrl: "https://fixture.test/places/cafe-update",
  rawPayload: {
    name: "Кафе Тест Обновление",
    shortDescription: "Обновлённые данные для существующего кафе",
    description: "Новое описание кафе после обновления.",
    address: "ул. Тестовая, 2, Минск",
    city: "Минск",
    phone: "+375297654321",
    website: "https://cafe-test-update.by",
    categories: ["кафе"],
    images: [],
  },
};

/**
 * PLACE-3: MERGE — частичные данные, venue похоже на существующий Place.
 * Ожидаемый результат: matchStatus=AMBIGUOUS, suggestedAction=MERGE.
 */
export const PLACE_MERGE = {
  externalId: "fixture-place-merge-001",
  sourceUrl: "https://fixture.test/places/park-merge",
  rawPayload: {
    name: "Парк Тест",
    description: "Городской парк для прогулок.",
    address: "ул. Парковая, 5, Минск",
    city: "Минск",
    categories: ["парк"],
    images: [],
  },
};

/**
 * PLACE-4: CATEGORY MAPPING FAILURE — категория не маппится в allowed values.
 * Ожидаемый результат: normalizeStatus=SUCCESS (partial),
 * apply завершится с ошибкой "category mapping failed".
 */
export const PLACE_CATEGORY_FAIL = {
  externalId: "fixture-place-catfail-001",
  sourceUrl: "https://fixture.test/places/unknown-category",
  rawPayload: {
    name: "Место с неизвестной категорией",
    shortDescription: "Тест провала маппинга категории",
    description: "Описание места.",
    address: "ул. Тестовая, 99, Минск",
    city: "Минск",
    categories: ["неизвестная_категория_xyz", "another_unknown"],
    images: [],
  },
};

// ── EVENT scenarios ───────────────────────────────────────────────────────────

/**
 * EVENT-1: CREATE_NEW — полные данные, все поля маппятся.
 * Ожидаемый результат: normalizeStatus=SUCCESS, qualityScore≈0.9,
 * matchStatus=NO_MATCH, suggestedAction=CREATE_NEW.
 */
export const EVENT_CREATE_FULL = {
  externalId: "fixture-event-create-001",
  sourceUrl: "https://fixture.test/events/workshop-full",
  rawPayload: {
    title: "Мастер-класс Тест Полный",
    shortDescription: "Тестовый мастер-класс с полными данными",
    description: "Полное описание тестового мастер-класса для детей 4-10 лет.",
    type: "EVENT",
    scheduleMode: "ONE_TIME",
    startDate: "2026-06-15T11:00:00",
    endDate: "2026-06-15T13:00:00",
    venue: "Арт-студия Тест",
    address: "ул. Тестовая, 10, Минск",
    city: "Минск",
    price: "25 BYN",
    ageRange: "4-10 лет",
    categories: ["мастер-класс", "творчество"],
    organizer: "Студия Тест",
    images: ["https://fixture.test/img/event1.jpg"],
  },
};

/**
 * EVENT-2: UPDATE_EXISTING — данные похожи на существующий Activity.
 * Для воспроизведения: нужен Activity с похожим title в БД.
 * Ожидаемый результат: matchStatus=MATCHED, suggestedAction=UPDATE_EXISTING.
 */
export const EVENT_UPDATE_EXISTING = {
  externalId: "fixture-event-update-001",
  sourceUrl: "https://fixture.test/events/course-update",
  rawPayload: {
    title: "Курс юного учёного",
    shortDescription: "Обновлённые данные курса",
    description: "Новое описание курса после обновления.",
    type: "COURSE",
    scheduleMode: "RECURRING",
    scheduleText: "Каждую субботу, 10:00-12:00",
    venue: "Центр Наука и жизнь",
    city: "Минск",
    price: "90 BYN / месяц",
    ageRange: "8-14 лет",
    categories: ["курс", "наука"],
    organizer: "Центр Наука и жизнь",
    images: [],
  },
};

/**
 * EVENT-3: MERGE с occurrence risk — похожее название + площадка + другая дата.
 * Ожидаемый результат: matchStatus=AMBIGUOUS, suggestedAction=MERGE,
 * possibleOccurrenceRisk=true в matchCandidates.
 */
export const EVENT_MERGE_OCCURRENCE_RISK = {
  externalId: "fixture-event-occurrence-001",
  sourceUrl: "https://fixture.test/events/workshop-repeat",
  rawPayload: {
    title: "Мастер-класс по рисованию для детей",
    shortDescription: "Повтор мастер-класса в следующем месяце",
    description: "Тот же мастер-класс, но в другую дату.",
    type: "EVENT",
    scheduleMode: "ONE_TIME",
    startDate: "2026-07-20T11:00:00",
    venue: "Арт-студия «Краски»",
    address: "ул. Немига, 5, Минск",
    city: "Минск",
    price: "25 BYN",
    ageRange: "4-10 лет",
    categories: ["мастер-класс"],
    organizer: "Арт-студия Краски",
    images: [],
  },
};

/**
 * EVENT-4: TYPE MAPPING FAILURE — type не маппится в ActivityType.
 * Ожидаемый результат: normalizeStatus=SUCCESS (partial, typeCandidate сохранён),
 * apply завершится с ошибкой "type mapping failed".
 */
export const EVENT_TYPE_FAIL = {
  externalId: "fixture-event-typefail-001",
  sourceUrl: "https://fixture.test/events/unknown-type",
  rawPayload: {
    title: "Событие с неизвестным типом",
    shortDescription: "Тест провала маппинга типа",
    description: "Описание события.",
    type: "UNKNOWN_TYPE_XYZ",
    scheduleMode: "ONE_TIME",
    startDate: "2026-06-01T10:00:00",
    city: "Минск",
    categories: ["тест"],
    images: [],
  },
};

/**
 * EVENT-5: SCHEDULE MODE MAPPING FAILURE — scheduleMode не маппится.
 * Ожидаемый результат: apply завершится с ошибкой "scheduleMode mapping failed".
 */
export const EVENT_SCHEDULE_FAIL = {
  externalId: "fixture-event-schedulefail-001",
  sourceUrl: "https://fixture.test/events/unknown-schedule",
  rawPayload: {
    title: "Событие с неизвестным расписанием",
    shortDescription: "Тест провала маппинга scheduleMode",
    description: "Описание события.",
    type: "EVENT",
    scheduleMode: "UNKNOWN_SCHEDULE_XYZ",
    startDate: "2026-06-01T10:00:00",
    city: "Минск",
    categories: ["тест"],
    images: [],
  },
};

// ── Scenario registry ─────────────────────────────────────────────────────────

export const PLACE_FIXTURES = {
  PLACE_CREATE_FULL,
  PLACE_UPDATE_EXISTING,
  PLACE_MERGE,
  PLACE_CATEGORY_FAIL,
} as const;

export const EVENT_FIXTURES = {
  EVENT_CREATE_FULL,
  EVENT_UPDATE_EXISTING,
  EVENT_MERGE_OCCURRENCE_RISK,
  EVENT_TYPE_FAIL,
  EVENT_SCHEDULE_FAIL,
} as const;

export type PlaceFixtureKey = keyof typeof PLACE_FIXTURES;
export type EventFixtureKey = keyof typeof EVENT_FIXTURES;
