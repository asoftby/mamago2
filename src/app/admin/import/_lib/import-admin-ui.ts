import type {
  ImportEntityType,
  ImportMatchStatus,
  ImportNormalizeStatus,
  ImportParseStatus,
  ImportReviewStatus,
  ImportReviewTaskStatus,
  ImportRunStatus,
  ImportSourceStatus,
  ImportSuggestedAction,
} from "@prisma/client";

export const importEntityLabels: Record<ImportEntityType, string> = {
  PLACE: "Место",
  EVENT: "Событие",
  OFFER: "Оффер",
};

export const importEntityBadgeClasses: Record<ImportEntityType, string> = {
  PLACE: "bg-sky-100 text-sky-800",
  EVENT: "bg-amber-100 text-amber-800",
  OFFER: "bg-emerald-100 text-emerald-800",
};

export const sourceStatusLabels: Record<ImportSourceStatus, string> = {
  ACTIVE: "Работает",
  PAUSED: "Отключён",
  DISABLED: "Отключён",
  ERROR: "Ошибка",
};

export const sourceStatusClasses: Record<ImportSourceStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  DISABLED: "bg-gray-100 text-gray-700",
  ERROR: "bg-rose-100 text-rose-800",
};

export const runStatusLabels: Record<ImportRunStatus, string> = {
  PENDING: "В очереди",
  RUNNING: "Идёт импорт",
  COMPLETED: "Завершён",
  FAILED: "С ошибкой",
  CANCELLED: "Остановлен",
};

export const runStatusClasses: Record<ImportRunStatus, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  RUNNING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-amber-100 text-amber-800",
};

export const taskStatusLabels: Record<ImportReviewTaskStatus, string> = {
  PENDING: "Нужно проверить",
  IN_PROGRESS: "В работе",
  COMPLETED: "Решение принято",
  CANCELLED: "Отменено",
};

export const taskStatusClasses: Record<ImportReviewTaskStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-gray-100 text-gray-700",
};

export const reviewStatusLabels: Record<ImportReviewStatus, string> = {
  PENDING: "Ожидает разбора",
  IN_REVIEW: "На ручной проверке",
  APPROVED: "Готов к публикации",
  REJECTED: "Отклонён",
  SKIPPED: "Пропущен",
};

export const reviewStatusClasses: Record<ImportReviewStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  IN_REVIEW: "bg-blue-100 text-blue-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  SKIPPED: "bg-gray-100 text-gray-700",
};

export const parseStatusLabels: Record<ImportParseStatus, string> = {
  PENDING: "Не обработан",
  SUCCESS: "Успешно",
  FAILED: "Ошибка парсинга",
  SKIPPED: "Пропущен",
};

export const normalizeStatusLabels: Record<ImportNormalizeStatus, string> = {
  PENDING: "Не нормализован",
  SUCCESS: "Нормализован",
  FAILED: "Ошибка нормализации",
  SKIPPED: "Пропущен",
};

export const matchStatusLabels: Record<ImportMatchStatus, string> = {
  PENDING: "Сравнение не запущено",
  MATCHED: "Найден кандидат",
  NO_MATCH: "Совпадений нет",
  AMBIGUOUS: "Нужно выбрать",
  SKIPPED: "Пропущен",
};

export const suggestedActionLabels: Record<ImportSuggestedAction, string> = {
  CREATE_NEW: "Создать новое",
  UPDATE_EXISTING: "Обновить существующее",
  MERGE: "Объединить",
  REJECT: "Отклонить",
  SKIP: "Пропустить",
};

export const suggestedActionClasses: Record<ImportSuggestedAction, string> = {
  CREATE_NEW: "bg-blue-100 text-blue-800",
  UPDATE_EXISTING: "bg-amber-100 text-amber-800",
  MERGE: "bg-violet-100 text-violet-800",
  REJECT: "bg-rose-100 text-rose-800",
  SKIP: "bg-gray-100 text-gray-700",
};

export function formatImportEntity(entity?: ImportEntityType | null) {
  return entity ? importEntityLabels[entity] : "Не указан";
}

export function getImportedObjectStage(params: {
  taskStatus?: ImportReviewTaskStatus | null;
  reviewStatus: ImportReviewStatus;
  publishedPlaceId?: string | null;
  publishedActivityId?: string | null;
  hasReviewTask?: boolean;
}) {
  if (params.hasReviewTask === false) {
    return {
      label: "Ошибка пайплайна",
      tone: "bg-rose-100 text-rose-800",
      helper:
        "У каждой ImportedRecord должна быть ImportReviewTask. Отсутствие задачи — нарушение инварианта (возможны старые данные или прямое вмешательство в БД).",
    };
  }

  if (params.publishedPlaceId) {
    return {
      label: "Создано место",
      tone: "bg-emerald-100 text-emerald-800",
      helper: "Импортированный объект уже связан с Place в каталоге.",
    };
  }

  if (params.publishedActivityId) {
    return {
      label: "Создано событие",
      tone: "bg-emerald-100 text-emerald-800",
      helper: "Импортированный объект уже связан с Event/Activity в каталоге.",
    };
  }

  if (params.reviewStatus === "REJECTED") {
    return {
      label: "Отклонён",
      tone: "bg-rose-100 text-rose-800",
      helper: "Объект не будет опубликован в каталоге.",
    };
  }

  if (params.reviewStatus === "IN_REVIEW") {
    return {
      label: "На ручной проверке",
      tone: "bg-blue-100 text-blue-800",
      helper: "Объект уже передан в ручную проверку, но финальная сущность ещё не создана.",
    };
  }

  if (params.reviewStatus === "SKIPPED") {
    return {
      label: "Пропущен",
      tone: "bg-gray-100 text-gray-700",
      helper: "Объект сохранён в истории импорта, но не участвует в публикации.",
    };
  }

  if (params.reviewStatus === "APPROVED") {
    return {
      label: "Готов к публикации",
      tone: "bg-emerald-100 text-emerald-800",
      helper: "Решение принято, финальная сущность ещё не создана.",
    };
  }

  if (params.taskStatus === "IN_PROGRESS") {
    return {
      label: "На разборе",
      tone: "bg-blue-100 text-blue-800",
      helper: "Импортированный объект сейчас проверяют вручную.",
    };
  }

  return {
    label: "Нужно проверить",
    tone: "bg-amber-100 text-amber-800",
    helper: "Это сырой импортированный объект. Он ещё не стал сущностью платформы.",
  };
}
