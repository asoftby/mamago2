import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";

export type PersistActivityMeta = {
  activityId: string;
  title: string;
  coverImageUrl?: string | null;
};

/**
 * Общая клиентская логика: план / идеи / снять с идей.
 * Вызывается после осознанного выбора (и после входа, если нужен auth).
 */
export async function persistActivitySave(
  result: SaveToPlanResult,
  meta: PersistActivityMeta,
): Promise<void> {
  if (result.action === "cancel") return;

  if (result.action === "plan") {
    const res = await fetch("/api/save/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityId: meta.activityId,
        date: result.dateISO,
        title: meta.title,
        coverImageUrl: meta.coverImageUrl,
      }),
    });
    if (!res.ok) throw new Error("plan_save_failed");
    return;
  }

  if (result.action === "ideas") {
    const res = await fetch("/api/save/idea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId: meta.activityId }),
    });
    if (!res.ok) throw new Error("idea_save_failed");
    return;
  }

  if (result.action === "remove-idea") {
    const res = await fetch(
      `/api/save/idea?activityId=${encodeURIComponent(meta.activityId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error("idea_remove_failed");
  }
}
