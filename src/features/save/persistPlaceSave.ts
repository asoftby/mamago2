import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";

export type PersistPlaceMeta = {
  placeId: string;
  placeSlug: string;
  title: string;
  coverImageUrl?: string | null;
};

/**
 * Клиентская логика сохранения места: план / идеи / снять.
 */
export async function persistPlaceSave(
  result: SaveToPlanResult,
  meta: PersistPlaceMeta,
): Promise<void> {
  if (result.action === "cancel") return;

  if (result.action === "plan") {
    const res = await fetch("/api/save/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId: meta.placeId,
        planPlaceSlug: meta.placeSlug,
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
      body: JSON.stringify({ placeId: meta.placeId }),
    });
    if (!res.ok) throw new Error("idea_save_failed");
    return;
  }

  if (result.action === "remove-idea") {
    const res = await fetch(
      `/api/save/idea?placeId=${encodeURIComponent(meta.placeId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error("idea_remove_failed");
    return;
  }

  if (result.action === "remove-plan") {
    const res = await fetch(
      `/api/save/plan?planItemId=${encodeURIComponent(result.planItemId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error("plan_remove_failed");
  }
}
