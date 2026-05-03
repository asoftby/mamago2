/**
 * Import Domain — TypeScript contracts
 * Phase 2A: расширен NormalizedPlaceImport под будущий publish в Place.
 */

// ─── Base ─────────────────────────────────────────────────────────────────────

/** Базовая структура нормализованного импорта */
export interface NormalizedImportPayload {
  entityType: "PLACE" | "EVENT";
  /** slug ImportSource */
  sourceSlug: string;
  externalId?: string | null;
  sourceUrl: string;
  sourceUpdatedAt?: Date;
  lang?: string;
}

// ─── Place ────────────────────────────────────────────────────────────────────

/**
 * Нормализованные данные места.
 * Поля спроектированы под будущий publish в текущую модель Place.
 *
 * Обязательные поля Place при создании:
 *   title, category, shortDesc, createdByUserId
 *
 * Покрытие:
 *   - title              → title?
 *   - category           → categoryCandidates[] (маппинг в Phase 3)
 *   - shortDesc          → shortDescCandidate? (truncate/derive в Phase 3)
 *   - createdByUserId    → системное поле, не в payload (Phase 3: import bot user)
 */
export interface NormalizedPlaceImport extends NormalizedImportPayload {
  entityType: "PLACE";

  // ── Обязательные для Place (кандидаты) ──────────────────────────────────
  /** Название места */
  title?: string;
  /**
   * Кандидаты для Place.category.
   * Финальный маппинг в строку-категорию — Phase 3.
   */
  categoryCandidates: string[];
  /**
   * Кандидат для Place.shortDesc (≤ 200 символов).
   * Если отсутствует — будет derive из description в Phase 3.
   */
  shortDescCandidate?: string;

  // ── Опциональные поля Place ──────────────────────────────────────────────
  description?: string;
  addressText?: string;
  cityName?: string;
  lat?: number;
  lng?: number;
  phones: string[];
  websites: string[];
  imageUrls: string[];
  openingHoursText?: string;
  /** URL соцсетей из источника (prefill редактора) */
  socialUrls?: string[];
}

// ─── Event ────────────────────────────────────────────────────────────────────

/**
 * Нормализованные данные события.
 * Поля спроектированы под будущий publish в текущую модель Activity.
 *
 * Обязательные поля Activity при создании:
 *   title, shortDesc, type, scheduleMode, ownerUserId
 *
 * Покрытие:
 *   - title            → title?
 *   - shortDesc        → shortDescCandidate? (derive из description)
 *   - type             → typeCandidate? (маппинг в Phase EVENT-publish)
 *   - scheduleMode     → scheduleModeCandidate? (маппинг в Phase EVENT-publish)
 *   - ownerUserId      → системное поле, не в payload
 */
export interface NormalizedEventImport extends NormalizedImportPayload {
  entityType: "EVENT";

  // ── Обязательные для Activity (кандидаты) ───────────────────────────────
  title?: string;
  /**
   * Кандидат для Activity.shortDesc (≤ 200 символов).
   * Derive из description если нет явного.
   */
  shortDescCandidate?: string;
  /**
   * Кандидат для Activity.type (EVENT | PERMANENT | COURSE | ROUTE | OFFER).
   * Маппинг в enum — Phase EVENT-publish.
   */
  typeCandidate?: string;
  formatCandidate?: "OFFLINE" | "ONLINE" | "HYBRID";
  /**
   * Кандидат для Activity.scheduleMode (ONE_TIME | MULTI_DATE | RECURRING | ON_DEMAND | ALWAYS).
   * Маппинг в enum — Phase EVENT-publish.
   */
  scheduleModeCandidate?: string;

  // ── Опциональные поля Activity ───────────────────────────────────────────
  description?: string;
  /** Название площадки (для будущего venue linking) */
  venueName?: string;
  addressText?: string;
  cityName?: string;
  /** ISO 8601 строка или человекочитаемая дата */
  startAt?: string;
  endAt?: string;
  /** Текстовое описание расписания (если нет структурированных дат) */
  scheduleText?: string;
  /** Строки расписания из источника (несколько дат/времён), без свёртки в одну дату */
  occurrenceLines?: string[];
  /** Текстовое описание возраста ("от 3 лет", "6-12 лет") */
  ageText?: string;
  /** Текстовое описание цены */
  priceText?: string;
  /** Имя организатора */
  organizerName?: string;
  categoryCandidates: string[];
  /**
   * AI-определённая категория события (если была определена автоматически).
   * Содержит ID категории, slug, путь и уверенность AI.
   */
  aiDetectedCategoryId?: string | null;
  aiDetectedCategorySlug?: string | null;
  aiDetectedCategoryPath?: string | null;
  aiDetectedCategoryConfidence?: number | null;
  /**
   * Постер / главное изображение со страницы источника (URL).
   * Не создаёт MediaAsset до явного действия пользователя в редакторе.
   */
  mainImageUrl?: string;
  /** Дополнительные изображения (URL), без mainImageUrl */
  imageUrls: string[];
  /** Телефон из карточки источника */
  phone?: string;
  /** Сайт организатора / события */
  website?: string;
  /** Ссылки на соцсети (полные URL) */
  socialUrls?: string[];
  /** URL трейлера (YouTube, VK Video и т.п.) */
  trailerUrl?: string;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/** Результат работы парсера для одной записи */
export interface ParsedRawRecord {
  externalId?: string | null;
  sourceUrl: string;
  canonicalSourceUrl?: string;
  rawPayload: Record<string, unknown>;
  rawText?: string;
  sourceUpdatedAt?: Date;
}

/** Результат парсинга всего источника */
export interface ParserResult {
  records: ParsedRawRecord[];
  /** Общее количество найденных записей (может быть больше records.length при пагинации) */
  totalFound: number;
  parserKey: string;
  error?: string;
}

// ─── Matching ─────────────────────────────────────────────────────────────────

/** Breakdown score-компонентов для одного кандидата */
export interface PlaceMatchSignals {
  /** Точное совпадение домена сайта */
  websiteDomainExact: boolean;
  /** Точное совпадение нормализованного телефона */
  phoneExact: boolean;
  /** Jaccard-сходство нормализованных названий [0..1] */
  titleSimilarity: number;
  /** Jaccard-сходство нормализованных адресов [0..1] */
  addressSimilarity: number;
  /** Расстояние между координатами в метрах (null если нет coords) */
  coordsDistanceMeters: number | null;
}

/** Один кандидат на совпадение с существующим Place */
export interface PlaceMatchCandidate {
  entityType: "PLACE";
  entityId: string;
  entityTitle: string;
  /** Итоговый score [0..1] */
  score: number;
  /** Человекочитаемое резюме причин совпадения */
  reason: string;
  signals: PlaceMatchSignals;
}

/** Итог matching для одной ImportedRecord */
export interface PlaceMatchResult {
  recordId: string;
  candidates: PlaceMatchCandidate[];
  /** Лучший кандидат (первый по score) */
  topCandidate: PlaceMatchCandidate | null;
  matchStatus: "NO_MATCH" | "MATCHED" | "AMBIGUOUS" | "FAILED";
  /** Рекомендуемое действие для review */
  suggestedAction: "CREATE_NEW" | "UPDATE_EXISTING" | "MERGE" | "REJECT";
  confidenceScore: number;
}

// ─── Event matching ───────────────────────────────────────────────────────────

/** Breakdown score-компонентов для одного EVENT кандидата */
export interface EventMatchSignals {
  /** Jaccard-сходство нормализованных названий [0..1] */
  titleSimilarity: number;
  /** Jaccard-сходство нормализованных названий площадки [0..1] */
  venueSimilarity: number;
  /** Jaccard-сходство нормализованных адресов [0..1] */
  addressSimilarity: number;
  /** Jaccard-сходство нормализованных имён организатора [0..1] */
  organizerSimilarity: number;
  /**
   * Близость дат начала в днях (null если нет данных).
   * 0 = точное совпадение, >30 = далеко.
   */
  startDateDeltaDays: number | null;
  /**
   * Флаг риска: похожее название + похожая площадка + РАЗНЫЕ даты.
   * Указывает на возможный повтор/occurrence, а не дубль master-event.
   */
  possibleOccurrenceRisk: boolean;
}

/** Один кандидат на совпадение с существующим Activity */
export interface EventMatchCandidate {
  entityType: "ACTIVITY";
  entityId: string;
  entityTitle: string;
  /** Итоговый score [0..1] */
  score: number;
  /** Человекочитаемое резюме */
  reason: string;
  signals: EventMatchSignals;
}

/** Итог matching для одной EVENT ImportedRecord */
export interface EventMatchResult {
  recordId: string;
  candidates: EventMatchCandidate[];
  topCandidate: EventMatchCandidate | null;
  matchStatus: "NO_MATCH" | "MATCHED" | "AMBIGUOUS" | "FAILED";
  suggestedAction: "CREATE_NEW" | "UPDATE_EXISTING" | "MERGE" | "REJECT";
  confidenceScore: number;
}

/** @deprecated используй PlaceMatchCandidate */
export interface MatchCandidate {
  entityType: "PLACE" | "ACTIVITY";
  entityId: string;
  score: number;
  reason: string;
  matchedFields: string[];
}

// ─── Review ───────────────────────────────────────────────────────────────────

/**
 * Payload решения ревьюера.
 * decision соответствует ImportDecision enum.
 * Сохраняется в ImportedRecord.reviewDecision (Json).
 */
export interface ReviewDecisionPayload {
  /** Соответствует ImportDecision enum */
  decision: "APPROVED_CREATE" | "APPROVED_UPDATE" | "APPROVED_MERGE" | "REJECTED" | "DEFERRED";
  /**
   * ID существующего Place или Activity (обязателен для APPROVED_UPDATE / APPROVED_MERGE).
   * null для APPROVED_CREATE / REJECTED / DEFERRED.
   */
  targetEntityId: string | null;
  /** PLACE для PLACE records, ACTIVITY для EVENT records */
  targetEntityType: "PLACE" | "ACTIVITY" | null;
  /** ID кандидата из matchCandidates, выбранного ревьюером */
  selectedCandidateId?: string | null;
  notes?: string | null;
  recovery?: ImportLinkRecoveryPayload | null;
  reviewedAt: string; // ISO string
  reviewerUserId: string;
}

export interface ImportLinkRecoveryPayload {
  detachedAt: string;
  invalidLinkedEntityId: string;
  invalidLinkedEntityType: "PLACE" | "ACTIVITY";
  reason: string;
}

// ─── Quality scoring ──────────────────────────────────────────────────────────

export interface PlaceQualitySignals {
  hasTitle: boolean;
  hasShortDesc: boolean;
  hasDescription: boolean;
  hasAddress: boolean;
  hasCity: boolean;
  hasCoords: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  hasImages: boolean;
  hasCategories: boolean;
}

export interface QualityScoringResult {
  score: number; // [0..1]
  signals: PlaceQualitySignals;
}

export interface EventQualitySignals {
  hasTitle: boolean;
  hasShortDesc: boolean;
  hasDescription: boolean;
  hasTypeCandidate: boolean;
  hasScheduleModeCandidate: boolean;
  hasVenueOrAddress: boolean;
  hasCity: boolean;
  hasStartAt: boolean;
  hasCategories: boolean;
  hasImages: boolean;
}

export interface EventQualityScoringResult {
  score: number; // [0..1]
  signals: EventQualitySignals;
}

// ─── Review task creation result ─────────────────────────────────────────────

export interface ReviewTaskCreationResult {
  recordId: string;
  taskId: string | null;
  created: boolean;
  reason: string;
}

// ─── Publish / Apply ──────────────────────────────────────────────────────────

/** Результат apply одной ImportedRecord в Place */
export interface PlaceApplyResult {
  success: boolean;
  recordId: string;
  decision: "APPROVED_CREATE" | "APPROVED_UPDATE" | "APPROVED_MERGE";
  /** ID Place (новый или существующий) */
  placeId: string;
  /** Final slug for EVENT apply flows (stored for UI shortcut/result block) */
  activitySlug?: string;
  /** Поля, которые были записаны */
  appliedFields: string[];
  /** Поля, пропущенные из-за ImportFieldOverride или title policy */
  skippedFields: string[];
  /** Поля, пропущенные потому что normalized value пустой */
  emptyFields: string[];
  error?: string;
}

/** Ошибка валидации перед apply */
export interface PlaceApplyValidationError {
  success: false;
  recordId: string;
  reason: string;
}

/**
 * Payload, сохраняемый в ImportedRecord.applyResult (Json).
 * Отдельно от reviewDecision — не мутирует human decision payload.
 */
export interface ImportApplyResultPayload {
  appliedAt: string;
  appliedByUserId: string;
  decision: string;
  placeId?: string;
  activityId?: string;
  activitySlug?: string;
  appliedFields: string[];
  skippedFields: string[];
  emptyFields: string[];
  warnings?: string[];
  note?: string;
}
