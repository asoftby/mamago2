/**
 * useOnboarding Hook
 * 
 * React hook для работы с onboarding orchestrator
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  OnboardingContext,
  OnboardingEntryPoint,
  PostAuthResult,
} from "./types";
import {
  startOnboarding,
  completeOnboarding,
  cancelOnboarding,
  getOnboardingContext,
} from "./orchestrator";
import { hasPendingAction } from "./pendingActionManager";

export interface UseOnboardingOptions {
  /** Auto-start onboarding on mount */
  autoStart?: boolean;
  
  /** Entry point */
  entryPoint?: OnboardingEntryPoint;
  
  /** Return URL */
  returnUrl?: string;
  
  /** Analytics metadata */
  analyticsMetadata?: Record<string, unknown>;
  
  /** Callback after completion */
  onComplete?: (result: PostAuthResult) => void;
  
  /** Callback after cancel */
  onCancel?: () => void;
}

export function useOnboarding(options: UseOnboardingOptions = {}) {
  const router = useRouter();
  const [context, setContext] = useState<OnboardingContext | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  // Load context on mount
  useEffect(() => {
    const existingContext = getOnboardingContext();
    if (existingContext) {
      setContext(existingContext);
      setIsActive(true);
    }
  }, []);
  
  // Auto-start if requested
  useEffect(() => {
    if (options.autoStart && options.entryPoint && !isActive) {
      handleStart();
    }
  }, [options.autoStart, options.entryPoint, isActive]);
  
  /**
   * Start onboarding flow
   */
  const handleStart = useCallback(() => {
    if (!options.entryPoint) {
      console.error("Entry point is required to start onboarding");
      return;
    }
    
    const newContext = startOnboarding(options.entryPoint, {
      returnUrl: options.returnUrl,
      analyticsMetadata: options.analyticsMetadata,
    });
    
    setContext(newContext);
    setIsActive(true);
  }, [options.entryPoint, options.returnUrl, options.analyticsMetadata]);
  
  /**
   * Complete onboarding flow
   */
  const handleComplete = useCallback(
    async (
      userId: string,
      completedSteps: string[] = [],
      skippedSteps: string[] = []
    ) => {
      setIsCompleting(true);
      
      try {
        const result = await completeOnboarding(userId, completedSteps, skippedSteps);
        
        setIsActive(false);
        setContext(null);
        
        // Call callback
        options.onComplete?.(result);
        
        // Handle redirect
        if (result.redirectTarget) {
          router.push(result.redirectTarget);
        } else if (result.nextAction?.type === "redirect" && result.nextAction.payload) {
          router.push(result.nextAction.payload as string);
        }
        
        return result;
      } catch (error) {
        console.error("Failed to complete onboarding:", error);
        throw error;
      } finally {
        setIsCompleting(false);
      }
    },
    [router, options.onComplete]
  );
  
  /**
   * Cancel onboarding flow
   */
  const handleCancel = useCallback(
    (reason?: string) => {
      cancelOnboarding(reason);
      setIsActive(false);
      setContext(null);
      options.onCancel?.();
    },
    [options.onCancel]
  );
  
  /**
   * Check if there's a pending action
   */
  const checkPendingAction = useCallback(() => {
    return hasPendingAction();
  }, []);
  
  return {
    /** Current onboarding context */
    context,
    
    /** Is onboarding active */
    isActive,
    
    /** Is completing onboarding */
    isCompleting,
    
    /** Start onboarding */
    start: handleStart,
    
    /** Complete onboarding */
    complete: handleComplete,
    
    /** Cancel onboarding */
    cancel: handleCancel,
    
    /** Check if there's a pending action */
    hasPendingAction: checkPendingAction,
  };
}
