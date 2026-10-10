"use client";

import { useEffect, useMemo, useState } from "react";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { addDaysLocal, getLocalDateKey } from "@/lib/date/localDateKey";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { toast } from "@/lib/toast";
import type { PlanItemWithActivity } from "../../types/event";

/** Заметке доступны любые даты — берём ближайшие два месяца, остальное листается в «Показать все даты». */
const NOTE_DATE_HORIZON_DAYS = 60;

type SessionsByDate = Record<string, Array<{ id: string; time: string }>>;

/** Можно ли перенести запись: событие каталога (по расписанию) или своя заметка. */
export function canMovePlanItem(item: PlanItemWithActivity): boolean {
  if (item.routeId || item.planRouteSlug || item.placeId || item.planPlaceSlug || item.articleId) return false;
  if (item.source === "MANUAL") return true;
  return Boolean(item.activityId);
}

function formatMovedTo(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/**
 * «Перенести» — та же шторка выбора даты, что и «Сохранить событие»
 * (SaveActivityFlowAdaptive), только с доступными датами записи:
 * для события — даты и сеансы из расписания, для заметки — любые даты.
 */
export function PlanMoveSheet({
  item,
  onClose,
  onMoved,
}: {
  item: PlanItemWithActivity | null;
  onClose: () => void;
  onMoved: (dateISO: string) => void;
}) {
  const isNote = item?.source === "MANUAL";
  const itemId = item?.id ?? null;
  const activityId = item?.activityId ?? null;
  const [catalog, setCatalog] = useState<{ itemId: string; dates: string[]; sessionsByDate: SessionsByDate } | null>(null);

  useEffect(() => {
    if (!itemId || isNote || !activityId) return;
    let cancelled = false;
    void fetch(`/api/save/available-plan-dates?activityId=${encodeURIComponent(activityId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { dates?: string[]; sessionsByDate?: SessionsByDate } | null) => {
        if (cancelled) return;
        setCatalog({
          itemId,
          dates: Array.isArray(payload?.dates) ? payload.dates : [],
          sessionsByDate: payload?.sessionsByDate ?? {},
        });
      })
      .catch(() => {
        if (!cancelled) setCatalog({ itemId, dates: [], sessionsByDate: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, isNote, activityId]);

  const noteDates = useMemo(() => {
    const today = getLocalDateKey();
    return Array.from({ length: NOTE_DATE_HORIZON_DAYS }, (_, i) => addDaysLocal(today, i));
  }, []);

  if (!item) return null;
  const ready = isNote || catalog?.itemId === item.id;
  if (!ready) return null;

  const title = item.title || item.activity?.title || "Запись";
  const dates = isNote ? noteDates : (catalog?.dates ?? []);
  const sessionsByDate = isNote ? undefined : catalog?.sessionsByDate;

  async function persist(result: SaveToPlanResult) {
    if (!item || result.action !== "plan") return;
    const previousDate = item.date;
    try {
      let response: Response;
      if (isNote) {
        response = await fetch(`/api/plan/manual/${item.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            date: result.dateISO,
            expectedUpdatedAt: new Date(item.updatedAt ?? Date.now()).toISOString(),
          }),
        });
      } else {
        response = await fetch("/api/save/plan", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            activityId: item.activityId,
            date: result.dateISO,
            activitySessionId: result.timeSlotId ?? null,
            title: item.title ?? item.activity?.title ?? undefined,
            coverImageUrl: item.coverImageUrl ?? undefined,
          }),
        });
      }
      if (!response.ok) throw new Error("move_failed");
      requestPlanRefetchForDate(previousDate);
      requestPlanRefetchForDate(result.dateISO);
      toast.success(`Перенесли на ${formatMovedTo(result.dateISO)}`);
      onMoved(result.dateISO);
    } catch (error) {
      toast.error("Не получилось перенести", { description: "Попробуйте ещё раз" });
      throw error;
    }
  }

  return (
    <SaveActivityFlowAdaptive
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isAuthenticated
      scenario={{
        kind: "quickdate",
        title,
        moveMode: true,
        eventPlanDateOptions: dates,
        eventPlanSessionsByDate: sessionsByDate,
      }}
      source="my_plan_move"
      onPersist={persist}
    />
  );
}
