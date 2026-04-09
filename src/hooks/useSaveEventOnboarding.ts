"use client";

import { useState, useCallback } from "react";
import {
  setPendingSaveEvent,
  setPendingSaveEventWithDate,
  type SaveEventAction,
  type SaveEventWithDateAction,
} from "@/lib/onboarding";

export interface UseSaveEventOnboardingOptions {
  /** Callback after successful save */
  onSaveComplete?: (result: { savedTo: "ideas" | "plan"; date?: string }) => void;
  
  /** Source context for analytics */
  sourceContext?: string;
}

export interface SaveEventParams {
  /** Activity ID */
  activityId: string;
  
  /** Activity title (optional) */
  activityTitle?: string;
  
  /** Selected date (if saving to plan) */
  selectedDate?: string;
  
  /** Time slot (if saving to plan) */
  timeSlot?: string;
}

/**
 * Hook for Save Event onboarding flow
 * 
 * Handles the complete flow:
 * 1. Check if user is authenticated
 * 2. If not, set pending action and open onboarding
 * 3. If yes, save directly
 */
export function useSaveEventOnboarding(options: UseSaveEventOnboardingOptions = {}) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingParams, setPendingParams] = useState<SaveEventParams | null>(null);
  
  /**
   * Initiate save event flow
   * 
   * If user is authenticated, saves directly.
   * If not, opens onboarding modal.
   */
  const initiateSave = useCallback(
    async (params: SaveEventParams, isAuthenticated: boolean) => {
      const { activityId, activityTitle, selectedDate, timeSlot } = params;
      
      if (isAuthenticated) {
        // User is authenticated - save directly
        try {
          if (selectedDate) {
            // Save to plan
            const response = await fetch("/api/plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                activityId,
                date: selectedDate,
                timeSlot,
              }),
            });
            
            if (!response.ok) {
              throw new Error("Failed to save to plan");
            }
            
            options.onSaveComplete?.({
              savedTo: "plan",
              date: selectedDate,
            });
          } else {
            // Save to ideas
            const response = await fetch("/api/ideas", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ activityId }),
            });
            
            if (!response.ok) {
              throw new Error("Failed to save to ideas");
            }
            
            options.onSaveComplete?.({
              savedTo: "ideas",
            });
          }
        } catch (error) {
          console.error("Failed to save event:", error);
          throw error;
        }
      } else {
        // User is not authenticated - set pending action and open onboarding
        if (selectedDate) {
          setPendingSaveEventWithDate(activityId, selectedDate, {
            activityTitle,
            timeSlot,
          });
        } else {
          setPendingSaveEvent(activityId, activityTitle);
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
