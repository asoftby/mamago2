import type { ContentSuccessOutcome } from "./types";

export type BreakingNewsAction = "save" | "submit" | "publish";

/**
 * Исход операции Breaking News строго по статусу из ответа сервера.
 * `null` — сервер вернул не то, что ожидалось для действия: успех заявлять нельзя.
 */
export function resolveBreakingNewsOutcome(
  action: BreakingNewsAction,
  status: string | null | undefined,
  /** Статус до операции: уже опубликованная новость — это правка, а не первая публикация. */
  previousStatus?: string | null,
): ContentSuccessOutcome | null {
  if (!status) return null;
  if (action === "save") {
    // Явное сохранение никогда не публикует и не отправляет на модерацию.
    if (status === "DRAFT") return "draft_saved";
    if (status === "PUBLISHED") return "changes_published";
    return "changes_saved";
  }
  if (action === "submit") {
    if (status === "PUBLISHED") return previousStatus === "PUBLISHED" ? "changes_published" : "published";
    if (status === "PENDING") return "submitted";
    return null;
  }
  if (status !== "PUBLISHED") return null;
  return previousStatus === "PUBLISHED" ? "changes_published" : "published";
}
