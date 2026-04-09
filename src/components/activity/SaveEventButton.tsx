"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSaveEventOnboarding } from "@/hooks/useSaveEventOnboarding";
import { SaveEventOnboarding } from "@/components/onboarding/SaveEventOnboarding";
import { toast } from "sonner";

export interface SaveEventButtonProps {
  /** Activity ID */
  activityId: string;
  
  /** Activity title */
  activityTitle?: string;
  
  /** Is user authenticated */
  isAuthenticated: boolean;
  
  /** Is already saved */
  isSaved?: boolean;
  
  /** Selected date (if saving to plan) */
  selectedDate?: string;
  
  /** Time slot (if saving to plan) */
  timeSlot?: string;
  
  /** Source context for analytics */
  sourceContext?: string;
  
  /** Button variant */
  variant?: "icon" | "button";
  
  /** Size */
  size?: "sm" | "md" | "lg";
  
  /** Custom className */
  className?: string;
}

export function SaveEventButton({
  activityId,
  activityTitle,
  isAuthenticated,
  isSaved = false,
  selectedDate,
  timeSlot,
  sourceContext = "activity_card",
  variant = "icon",
  size = "md",
  className,
}: SaveEventButtonProps) {
  const [saved, setSaved] = useState(isSaved);
  const [isLoading, setIsLoading] = useState(false);
  
  const {
    showOnboarding,
    pendingParams,
    initiateSave,
    closeOnboarding,
    handleSaveComplete,
  } = useSaveEventOnboarding({
    sourceContext,
    onSaveComplete: (result) => {
      setSaved(true);
      
      // Show success toast
      if (result.savedTo === "plan" && result.date) {
        toast.success("Добавлено в план", {
          description: `Активность сохранена на ${formatDateRu(result.date)}`,
        });
      } else {
        toast.success("Сохранено в идеи", {
          description: "Вы сможете вернуться к этому позже",
        });
      }
    },
  });
  
  const handleClick = async () => {
    if (saved) {
      // Already saved - could implement unsave here
      return;
    }
    
    setIsLoading(true);
    
    try {
      await initiateSave(
        {
          activityId,
          activityTitle,
          selectedDate,
          timeSlot,
        },
        isAuthenticated
      );
      
      // If authenticated, save was completed directly
      if (isAuthenticated) {
        setSaved(true);
      }
    } catch (error) {
      console.error("Failed to save event:", error);
      toast.error("Не удалось сохранить", {
        description: "Попробуйте ещё раз",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Icon sizes
  const iconSize = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }[size];
  
  // Button sizes
  const buttonSize = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  }[size];
  
  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={isLoading}
          className={cn(
            "inline-flex items-center justify-center rounded-full transition-colors",
            "hover:bg-neutral-100 active:scale-95",
            saved ? "text-red-500" : "text-neutral-500 hover:text-red-500",
            isLoading && "opacity-50 cursor-not-allowed",
            buttonSize,
            className
          )}
          aria-label={saved ? "Убрать из сохранённых" : "Сохранить"}
        >
          <Heart
            className={cn(iconSize, saved && "fill-current")}
            strokeWidth={saved ? 0 : 2}
          />
        </button>
      </>
    );
  }
  
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors",
          saved
            ? "bg-red-50 text-red-600 hover:bg-red-100"
            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
          isLoading && "opacity-50 cursor-not-allowed",
          buttonSize,
          className
        )}
      >
        <Heart
          className={cn(iconSize, saved && "fill-current")}
          strokeWidth={saved ? 0 : 2}
        />
        <span>{saved ? "Сохранено" : "Сохранить"}</span>
      </button>

      {showOnboarding && pendingParams && (
        <SaveEventOnboarding
          open={showOnboarding}
          onOpenChange={closeOnboarding}
          activityId={pendingParams.activityId}
          activityTitle={pendingParams.activityTitle}
          selectedDate={pendingParams.selectedDate}
          timeSlot={pendingParams.timeSlot}
          sourceContext={sourceContext}
          onSaveComplete={handleSaveComplete}
        />
      )}
    </>
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
