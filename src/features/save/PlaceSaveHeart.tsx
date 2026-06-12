"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { persistPlaceSave } from "@/features/save/persistPlaceSave";

type PlaceSaveHeartProps = {
  placeId: string;
  placeSlug: string;
  placeTitle: string;
  coverImageUrl?: string | null;
  source?: string;
  className?: string;
  iconClassName?: string;
};

function formatPlanDateRu(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function PlaceSaveHeart({
  placeId,
  placeSlug,
  placeTitle,
  coverImageUrl,
  source = "place-detail",
  className,
  iconClassName,
}: PlaceSaveHeartProps) {
  const { isAuthenticated } = useAuthMe();
  const [flowOpen, setFlowOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState({
    isIdea: false,
    inPlan: false,
    planDate: null as string | null,
    planStartsAt: null as string | null,
    planItemId: null as string | null,
  });

  const isSaved = saveStatus.isIdea || saveStatus.inPlan;

  const checkSaveStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/save/status?placeId=${encodeURIComponent(placeId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setSaveStatus({
        isIdea: Boolean(data.isIdea),
        inPlan: Boolean(data.inPlan),
        planDate: data.planDate ?? null,
        planStartsAt: data.planStartsAt ?? null,
        planItemId: data.planItemId ?? null,
      });
    } catch (error) {
      console.error("Failed to check place save status:", error);
    }
  }, [placeId]);

  useEffect(() => {
    void checkSaveStatus();
  }, [checkSaveStatus]);

  useEffect(() => {
    if (flowOpen) return;
    void checkSaveStatus();
  }, [flowOpen, checkSaveStatus]);

  const handlePersist = useCallback(
    async (result: SaveToPlanResult) => {
      setIsLoading(true);
      try {
        await persistPlaceSave(result, {
          placeId,
          placeSlug,
          title: placeTitle,
          coverImageUrl,
        });

        if (result.action === "plan") {
          toast.success("Добавлено в план", {
            description: `Визит на ${formatPlanDateRu(result.dateISO)}`,
          });
        } else if (result.action === "ideas") {
          toast.success("Сохранено в идеи", {
            description: "Вы сможете вернуться к этому месту позже",
          });
        } else if (result.action === "remove-idea") {
          toast.success("Убрано из идей");
        } else if (result.action === "remove-plan") {
          toast.success("Убрано из плана");
        }
      } catch {
        toast.error("Не получилось выполнить действие", {
          description: "Попробуйте ещё раз",
        });
        throw new Error("place_save_failed");
      } finally {
        setIsLoading(false);
      }
    },
    [coverImageUrl, placeId, placeSlug, placeTitle],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setFlowOpen(true)}
        disabled={isLoading}
        aria-label={isSaved ? "Изменить сохранение" : "Сохранить в план или в идеи"}
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border transition-all",
          isSaved
            ? "border-[#E86A3A] bg-[#FFE8DC] text-[#C24E22]"
            : "border-[rgba(20,18,16,0.18)] bg-transparent text-[rgba(20,18,16,0.45)] hover:border-[#141210] hover:text-[#141210]",
          isLoading && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <Heart
          className={cn("h-5 w-5", isSaved && "fill-current", iconClassName)}
        />
      </button>

      <SaveActivityFlowAdaptive
        open={flowOpen}
        onOpenChange={setFlowOpen}
        isAuthenticated={isAuthenticated}
        scenario={{
          kind: "quickdate",
          title: placeTitle,
        }}
        source={source}
        onPersist={handlePersist}
        isIdea={saveStatus.isIdea}
        inPlan={saveStatus.inPlan}
        planDate={saveStatus.planDate}
        planStartsAt={saveStatus.planStartsAt}
        planItemId={saveStatus.planItemId}
      />
    </>
  );
}
