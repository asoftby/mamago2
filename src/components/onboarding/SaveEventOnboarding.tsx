"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { toast } from "sonner";

export interface SaveEventOnboardingProps {
  /** Is modal open */
  open: boolean;
  
  /** Handle open change */
  onOpenChange: (open: boolean) => void;
  
  /** Activity ID to save */
  activityId: string;
  
  /** Activity title (optional, for better UX) */
  activityTitle?: string;
  
  /** Source context for analytics */
  sourceContext?: string;
  
  /** Callback after successful save */
  onSaveComplete?: (result: { savedTo: "ideas" | "plan"; date?: string }) => void;
}

export function SaveEventOnboarding({
  open,
  onOpenChange,
  activityId,
  activityTitle = "Событие",
  sourceContext,
  onSaveComplete,
}: SaveEventOnboardingProps) {
  const router = useRouter();

  const handlePersist = useCallback(
    async (result: SaveToPlanResult) => {
      if (result.action === "cancel") return;

      try {
        if (result.action === "plan") {
          const res = await fetch("/api/save/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              activityId,
              date: result.dateISO,
              title: activityTitle,
            }),
          });
          if (!res.ok) throw new Error("plan_save_failed");
          
          toast.success("Добавлено в план", {
            description: `Событие сохранено на ${formatDateRu(result.dateISO)}`,
            action: {
              label: "Открыть план",
              onClick: () => router.push("/?myPlan=open"),
            },
            duration: 4000,
          });
          
          onSaveComplete?.({
            savedTo: "plan",
            date: result.dateISO,
          });
        } else if (result.action === "ideas") {
          const res = await fetch("/api/save/idea", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activityId }),
          });
          if (!res.ok) throw new Error("idea_save_failed");
          
          toast.success("Сохранено в идеи", {
            description: "Вы сможете вернуться к этому позже",
            action: {
              label: "Открыть идеи",
              onClick: () => router.push("/me/ideas"),
            },
            duration: 4000,
          });
          
          onSaveComplete?.({
            savedTo: "ideas",
          });
        }
      } catch (error) {
        console.error("Failed to save event:", error);
        toast.error("Не удалось сохранить событие", {
          description: "Попробуйте ещё раз",
        });
        throw error;
      }
    },
    [activityId, activityTitle, onSaveComplete, router],
  );

  const nextHref =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/";

  return (
    <SaveActivityFlowAdaptive
      open={open}
      onOpenChange={onOpenChange}
      isAuthenticated={false}
      scenario={{ kind: "quickdate", title: activityTitle }}
      onPersist={handlePersist}
      nextHref={nextHref}
    />
  );
}

/**
 * Format date in Russian
 */
function formatDateRu(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}
