"use client";

import { useState, useCallback } from "react";
import { toast } from "@/lib/toast";
import {
  setPendingSaveRouteToPlan,
  setPendingSaveRouteToIdeas,
} from "@/lib/onboarding";

export interface UseSaveRouteOnboardingOptions {
  /** Callback after successful save */
  onSaveComplete?: (result: { savedTo: "ideas" | "plan"; date?: string }) => void;
  
  /** Source context for analytics */
  sourceContext?: string;
}

async function throwIfSaveFailed(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  let apiMessage: string | null = null;
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim()) {
      apiMessage = data.error.trim();
    }
  } catch {
    // ignore JSON parse errors
  }
  throw new Error(apiMessage ?? `${fallback} (${response.status})`);
}

export interface SaveRouteParams {
  /** Route ID */
  routeId: string;
  
  /** Route slug */
  routeSlug: string;
  
  /** Route title (optional) */
  routeTitle?: string;

  /** Cover URL for plan row when маршрут не в БД */
  coverImageUrl?: string;

  /** «Идеи» требуют строку Route в БД; для демо-маршрутов — false */
  allowSaveToIdeas?: boolean;
  
  /** Selected date (if saving to plan) */
  selectedDate?: string;
}

/**
 * Hook for Save Route onboarding flow
 * 
 * Handles the complete flow:
 * 1. Check if user is authenticated
 * 2. If not, set pending action and open onboarding
 * 3. If yes, save directly
 */
export function useSaveRouteOnboarding(options: UseSaveRouteOnboardingOptions = {}) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingParams, setPendingParams] = useState<SaveRouteParams | null>(null);
  
  /**
   * Initiate save route flow
   * 
   * If user is authenticated, saves directly.
   * If not, opens onboarding modal.
   */
  const initiateSave = useCallback(
    async (params: SaveRouteParams, isAuthenticated: boolean) => {
      const {
        routeId,
        routeSlug,
        routeTitle,
        coverImageUrl,
        allowSaveToIdeas = true,
        selectedDate,
      } = params;

      if (!selectedDate && !allowSaveToIdeas) {
        toast.error("Сохранение в идеи недоступно для этого маршрута", {
          description: "Добавьте маршрут в план или откройте опубликованный маршрут из каталога",
        });
        return;
      }
      
      if (isAuthenticated) {
        // User is authenticated - save directly
        try {
          if (selectedDate) {
            // Save to plan
            const response = await fetch("/api/plan/routes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                routeId,
                routeSlug,
                date: selectedDate,
                title: routeTitle,
                coverImageUrl,
              }),
            });
            
            await throwIfSaveFailed(response, "Failed to save route to plan");
            
            options.onSaveComplete?.({
              savedTo: "plan",
              date: selectedDate,
            });
          } else {
            // Save to ideas
            const response = await fetch("/api/ideas/routes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                routeId,
                routeSlug,
              }),
            });
            
            await throwIfSaveFailed(response, "Failed to save route to ideas");
            
            options.onSaveComplete?.({
              savedTo: "ideas",
            });
          }
        } catch (error) {
          console.error("Failed to save route:", error);
          throw error;
        }
      } else {
        // User is not authenticated - set pending action and open onboarding
        if (selectedDate) {
          setPendingSaveRouteToPlan(routeId, routeSlug, selectedDate, {
            routeTitle,
            coverImageUrl,
          });
        } else {
          setPendingSaveRouteToIdeas(routeId, routeSlug, {
            routeTitle,
            coverImageUrl,
          });
        }
        
        // Store params for onboarding modal
        setPendingParams(params);
        
        // Open onboarding modal
        setShowOnboarding(true);
      }
    },
    [options]
  );
  
  /**
   * Close onboarding modal
   */
  const closeOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setPendingParams(null);
  }, []);
  
  /**
   * Handle save complete from onboarding
   */
  const handleSaveComplete = useCallback(
    (result: { savedTo: "ideas" | "plan"; date?: string }) => {
      options.onSaveComplete?.(result);
      closeOnboarding();
    },
    [options, closeOnboarding]
  );
  
  return {
    /** Is onboarding modal open */
    showOnboarding,
    
    /** Pending save params */
    pendingParams,
    
    /** Initiate save flow */
    initiateSave,
    
    /** Close onboarding modal */
    closeOnboarding,
    
    /** Handle save complete */
    handleSaveComplete,
  };
}
