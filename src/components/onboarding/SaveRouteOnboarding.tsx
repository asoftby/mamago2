"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { toast } from "@/lib/toast";
import { apiFetch } from "@/lib/api/fetch";

export interface SaveRouteOnboardingProps {
  /** Is modal open */
  open: boolean;
  
  /** Handle open change */
  onOpenChange: (open: boolean) => void;
  
  /** Route ID to save */
  routeId: string;
  
  /** Route slug */
  routeSlug: string;
  
  /** Route title (optional, for better UX) */
  routeTitle?: string;
  
  /** Source context for analytics */
  sourceContext?: string;
  
  /** Callback after successful save */
  onSaveComplete?: (result: { savedTo: "ideas" | "plan"; date?: string }) => void;
}

export function SaveRouteOnboarding({
  open,
  onOpenChange,
  routeId,
  routeSlug,
  routeTitle = "Маршрут",
  sourceContext,
  onSaveComplete,
}: SaveRouteOnboardingProps) {
  const router = useRouter();

  const handlePersist = useCallback(
    async (result: SaveToPlanResult) => {
      if (result.action === "cancel") return;

      try {
        if (result.action === "plan") {
          const res = await apiFetch("/api/save/plan", {
            method: "POST",
            body: JSON.stringify({
              routeId: routeId,
              planRouteSlug: routeSlug,
              date: result.dateISO,
              title: routeTitle,
            }),
          });
          if (!res.ok) throw new Error("plan_save_failed");
          
          toast.success("Маршрут добавлен в план", {
            description: `Сохранено на ${formatDateRu(result.dateISO)}`,
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
          const res = await apiFetch("/api/save/idea", {
            method: "POST",
            body: JSON.stringify({ activityId: routeId }),
          });
          if (!res.ok) throw new Error("idea_save_failed");
          
          toast.success("Маршрут сохранён в идеи", {
            description: "Вы сможете вернуться к нему позже",
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
        console.error("Failed to save route:", error);
        toast.error("Не удалось сохранить маршрут", {
          description: "Попробуйте ещё раз",
        });
        throw error;
      }
    },
    [routeId, routeSlug, routeTitle, onSaveComplete, router],
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
      scenario={{ kind: "quickdate", title: routeTitle }}
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
