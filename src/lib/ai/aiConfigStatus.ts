/**
 * Диагностика настройки AI для админки: что задано, что нет и какие функции от
 * этого зависят. Возвращает ТОЛЬКО признаки «задано / не задано». Значение
 * ключа не возвращается нигде: ни целиком, ни частью, ни длиной. Имя модели не
 * секрет и показывается, но только если выглядит как идентификатор модели.
 *
 * Чтение окружения повторяет то, что делают `readOpenRouterConfig` и
 * `readCaptureModelConfig` (обрезка пробелов, пустое значение = не задано).
 */

/** Модель по умолчанию для enrichEvent, detectEventCategory и ai/rewrite, если OPENROUTER_MODEL не задан. */
export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";

export type AiConfigKey =
  | "OPENROUTER_API_KEY"
  | "OPENROUTER_CAPTURE_MODEL"
  | "OPENROUTER_CAPTURE_MODEL_STRONG"
  | "OPENROUTER_MODEL"
  | "OPENROUTER_SITE_APP";

/** ok: всё в порядке; warning: не задано, и часть функций не работает; info: необязательно, есть запасное поведение. */
export type AiConfigSeverity = "ok" | "warning" | "info";

export interface AiConfigItem {
  key: AiConfigKey;
  /** Для OPENROUTER_SITE_APP: «задано», только если заданы обе переменные. */
  isSet: boolean;
  severity: AiConfigSeverity;
  /** Имя модели (не секрет). Для ключа и остальных строк всегда отсутствует. */
  modelName?: string;
  /** Функции, которые зависят от параметра. */
  dependents: string[];
  /** Что происходит, когда параметр не задан (или что он даёт, когда задан). */
  note: string;
}

export interface AiConfigStatus {
  items: AiConfigItem[];
  /** true, если не задан ключ или быстрая модель Capture: посты каналов откладываются. */
  channelNormalizationBlocked: boolean;
}

// Идентификатор модели OpenRouter всегда «поставщик/модель». Строка без слеша (например, случайно
// вставленный в это поле ключ вида sk-or-...) не показывается.
const MODEL_NAME_RE = /^[A-Za-z0-9._-]{1,40}\/[A-Za-z0-9._:@-]{1,80}$/;

function readFlag(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Имя модели, если оно похоже на идентификатор модели; иначе ничего (значение не эхоим). */
function safeModelName(value: string | null): string | undefined {
  return value && MODEL_NAME_RE.test(value) ? value : undefined;
}

export function getAiConfigStatus(env: Record<string, string | undefined> = process.env): AiConfigStatus {
  const apiKey = readFlag(env.OPENROUTER_API_KEY);
  const fast = readFlag(env.OPENROUTER_CAPTURE_MODEL);
  const strong = readFlag(env.OPENROUTER_CAPTURE_MODEL_STRONG);
  const general = readFlag(env.OPENROUTER_MODEL);
  const siteUrl = readFlag(env.OPENROUTER_SITE_URL);
  const appName = readFlag(env.OPENROUTER_APP_NAME);

  const items: AiConfigItem[] = [
    {
      key: "OPENROUTER_API_KEY",
      isSet: apiKey !== null,
      severity: apiKey ? "ok" : "warning",
      dependents: ["Capture", "нормализатор постов каналов", "обогащение событий", "определение категории", "AI-переписывание описаний"],
      note: apiKey
        ? "Ключ задан. Значение не показывается."
        : "Ключ не задан: все AI-функции выключены.",
    },
    {
      key: "OPENROUTER_CAPTURE_MODEL",
      isSet: fast !== null,
      severity: fast ? "ok" : "warning",
      ...(safeModelName(fast) ? { modelName: safeModelName(fast) } : {}),
      dependents: ["Capture", "нормализатор постов каналов"],
      note: fast
        ? "Быстрая модель задана."
        : "Не задана: посты каналов откладываются, а Capture не распознаёт скриншоты.",
    },
    {
      key: "OPENROUTER_CAPTURE_MODEL_STRONG",
      isSet: strong !== null,
      severity: strong ? "ok" : "info",
      ...(safeModelName(strong) ? { modelName: safeModelName(strong) } : {}),
      dependents: ["Capture", "нормализатор постов каналов"],
      note: strong
        ? "Сильная модель задана."
        : "Необязательно. Без неё нет повторной попытки на сильной модели, когда быстрая вернула неверный ответ или спорную дату.",
    },
    {
      key: "OPENROUTER_MODEL",
      isSet: general !== null,
      severity: general ? "ok" : "info",
      ...(safeModelName(general) ? { modelName: safeModelName(general) } : {}),
      dependents: ["обогащение событий", "определение категории", "AI-переписывание описаний"],
      note: general
        ? "Модель задана."
        : `Не задана: используется модель по умолчанию ${DEFAULT_OPENROUTER_MODEL}.`,
    },
    {
      key: "OPENROUTER_SITE_APP",
      isSet: siteUrl !== null && appName !== null,
      severity: siteUrl !== null && appName !== null ? "ok" : "info",
      dependents: ["все AI-запросы к провайдеру"],
      note:
        siteUrl !== null && appName !== null
          ? "OPENROUTER_SITE_URL и OPENROUTER_APP_NAME заданы."
          : "OPENROUTER_SITE_URL или OPENROUTER_APP_NAME не заданы: провайдер модели получает значения по умолчанию, которые называют проект. Задайте нейтральные.",
    },
  ];

  return { items, channelNormalizationBlocked: apiKey === null || fast === null };
}

/** Блок конфигурации AI виден только администратору (не модератору). */
export function canSeeAiConfig(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === "ADMIN";
}
