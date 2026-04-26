"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { toast } from "@/lib/toast";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { persistActivitySave } from "@/features/save/persistActivitySave";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { getLocalDateKey } from "@/lib/date/localDateKey";

type SaveHeartProps = {
  activityId: string;
  activityTitle: string;
  coverImageUrl?: string | null;
  /** Если известна единственная дата сеанса, показываем в модалке только её для «В план». */
  eventPlanDateISO?: string | null;
  className?: string;
  onSaveChange?: (isSaved: boolean) => void;
};

function formatPlanDateRu(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function normalizePlanDateISO(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return getLocalDateKey(parsed);
}

export function SaveHeart({
  activityId,
  activityTitle,
  coverImageUrl,
  eventPlanDateISO,
  className,
  onSaveChange,
}: SaveHeartProps) {
  const { isAuthenticated } = useAuthMe();
  const [flowOpen, setFlowOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [eventPlanDateOptions, setEventPlanDateOptions] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState({
    isIdea: false,
    inPlan: false,
    planDate: null as string | null,
    planStartsAt: null as string | null,
  });

  const isSaved = saveStatus.isIdea || saveStatus.inPlan;
  const normalizedEventPlanDateISO = normalizePlanDateISO(eventPlanDateISO);

  const checkSaveStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/save/status?activityId=${activityId}`);
      if (!res.ok) return;
      const data = await res.json();
      setSaveStatus({
        isIdea: Boolean(data.isIdea),
        inPlan: Boolean(data.inPlan),
        planDate: data.planDate ?? null,
        planStartsAt: data.planStartsAt ?? null,
      });
    } catch (error) {
      console.error("Failed to check save status:", error);
    }
  }, [activityId]);

  useEffect(() => {
    void checkSaveStatus();
  }, [checkSaveStatus]);

  useEffect(() => {
    if (!flowOpen) return;
    void checkSaveStatus();
  }, [flowOpen, checkSaveStatus]);

  useEffect(() => {
    let cancelled = false;
    const loadPlanDates = async () => {
      try {
        const res = await fetch(`/api/save/available-plan-dates?activityId=${activityId}`);
        if (!res.ok) return;
        const payload = (await res.json()) as { dates?: string[] };
        if (cancelled) return;
        setEventPlanDateOptions(Array.isArray(payload.dates) ? payload.dates : []);
      } catch {
        if (!cancelled) setEventPlanDateOptions([]);
      }
    };
    void loadPlanDates();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  const handlePersist = useCallback(
    async (result: SaveToPlanResult) => {
      setIsLoading(true);
      try {
        await persistActivitySave(result, {
          activityId,
          title: activityTitle,
          coverImageUrl,
        });

        if (result.action === "plan") {
          toast.success("Добавлено в план", {
            description: `Событие на ${formatPlanDateRu(result.dateISO)}`,
          });
        } else if (result.action === "ideas") {
          toast.success("Сохранено в идеи", {
            description: "Вы сможете вернуться к этому позже",
          });
        } else if (result.action === "remove-idea") {
          toast.success("Убрано из идей");
        }

        await checkSaveStatus();
        onSaveChange?.(true);
        triggerAnimation();
      } catch (e) {
        toast.error("Не получилось выполнить действие", {
          description: "Попробуйте ещё раз",
        });
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [activityId, activityTitle, coverImageUrl, checkSaveStatus, onSaveChange],
  );

  const triggerAnimation = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFlowOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleHeartClick}
        disabled={isLoading}
        aria-label={isSaved ? "Изменить сохранение" : "Сохранить в план или в идеи"}
        title={isSaved ? "Изменить сохранение" : "Сохранить"}
        className={cn(
          "group flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white shadow-sm transition-all hover:scale-105 active:scale-95",
          isSaved ? "text-primary" : "text-muted-foreground hover:text-primary",
          isLoading && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <Heart
          className={cn(
            "h-5 w-5 transition-all duration-300",
            isSaved && "fill-current",
            isAnimating && "scale-125",
          )}
        />
      </button>

      <SaveActivityFlowAdaptive
        open={flowOpen}
        onOpenChange={setFlowOpen}
        isAuthenticated={isAuthenticated}
        scenario={{
          kind: "quickdate",
          title: activityTitle,
          eventPlanDateISO: normalizedEventPlanDateISO,
          eventPlanDateOptions: eventPlanDateOptions,
        }}
        onPersist={handlePersist}
        isIdea={saveStatus.isIdea}
        inPlan={saveStatus.inPlan}
        planDate={saveStatus.planDate}
        planStartsAt={saveStatus.planStartsAt}
      />
    </>
  );
}
