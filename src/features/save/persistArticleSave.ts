import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";

export type PersistArticleMeta = {
  articleId: string;
  title: string;
  coverImageUrl?: string | null;
};

/**
 * Клиентская логика сохранения статьи: только идеи (без даты).
 * Статьи не поддерживают сохранение на конкретную дату — save UI для Article
 * рендерит idea-only сценарий (см. SaveToPlanModal `ideaOnly`), поэтому
 * "plan"/"remove-plan" сюда прийти не должны.
 */
export async function persistArticleSave(
  result: SaveToPlanResult,
  meta: PersistArticleMeta,
): Promise<void> {
  if (result.action === "cancel") return;

  if (result.action === "ideas") {
    const res = await fetch("/api/save/idea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: meta.articleId }),
    });
    if (!res.ok) throw new Error("idea_save_failed");
    return;
  }

  if (result.action === "remove-idea") {
    const res = await fetch(
      `/api/save/idea?articleId=${encodeURIComponent(meta.articleId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error("idea_remove_failed");
    return;
  }

  throw new Error("article_date_save_unsupported");
}
