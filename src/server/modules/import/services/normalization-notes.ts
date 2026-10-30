/**
 * Итог нормализации запуска: что получилось, что провалилось и что отложено.
 *
 * Отложенные посты (нет настроенной модели или исчерпан лимит вызовов на
 * запуск) не ошибка: они сохранены и будут обработаны следующим запуском. Но
 * молчать об этом нельзя: иначе запуск выглядит успешным, а данных нет.
 */

/** Префикс, с которого нормализатор Telegram начинает причину отсрочки. */
export const POSTPONED_PREFIX = "postponed:";

export interface NormalizationSummary {
  success: number;
  failed: number;
  postponed: number;
  /** Причины отсрочки без префикса: `model_not_configured`, `budget`. */
  postponedReasons: string[];
}

export function summarizeNormalization(results: { success: boolean; error?: string }[]): NormalizationSummary {
  const isPostponed = (r: { success: boolean; error?: string }) => !r.success && Boolean(r.error?.startsWith(POSTPONED_PREFIX));
  const postponed = results.filter(isPostponed);
  return {
    success: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success && !isPostponed(r)).length,
    postponed: postponed.length,
    postponedReasons: [...new Set(postponed.map((r) => r.error!.slice(POSTPONED_PREFIX.length).trim()))],
  };
}

function postsPhrase(n: number): string {
  const abs = n % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${n} постов ждут`;
  if (last === 1) return `${n} пост ждёт`;
  if (last > 1 && last < 5) return `${n} поста ждут`;
  return `${n} постов ждут`;
}

/** Текст для администратора; null, если ничего не отложено. */
export function describePostponed(summary: NormalizationSummary, callBudgetPerRun?: number): string | null {
  if (summary.postponed === 0) return null;
  const parts = [`${postsPhrase(summary.postponed)} нормализации.`];
  if (summary.postponedReasons.includes("model_not_configured")) {
    parts.push(
      "Модель не настроена: задайте OPENROUTER_API_KEY и OPENROUTER_CAPTURE_MODEL на сервере и запустите импорт ещё раз. Сохранённые посты обработаются, заново скачивать ничего не нужно.",
    );
  }
  if (summary.postponedReasons.includes("budget")) {
    parts.push(
      `Исчерпан лимит вызовов модели на запуск${callBudgetPerRun ? ` (${callBudgetPerRun})` : ""}: остальное обработается следующим запуском.`,
    );
  }
  return parts.join(" ");
}
