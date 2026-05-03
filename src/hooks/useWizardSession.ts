/**
 * Hook for managing wizard session ID
 * Generates and persists wizardSessionId for temp media uploads
 */

import { useState, useEffect, useCallback } from "react";
import { randomId } from "@/lib/utils/randomId";

const WIZARD_DEBUG = process.env.NEXT_PUBLIC_WIZARD_DEBUG === "true";

interface WizardSessionOptions {
  userId?: string;
  wizardType: "place" | "activity" | "offer" | "event";
  entityId?: string; // placeId, activityId, eventId, etc. for editing existing entities
}

export function useWizardSession({ userId, wizardType, entityId }: WizardSessionOptions) {
  const [wizardSessionId, setWizardSessionId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Generate storage key for session ID
  const getSessionKey = useCallback(() => {
    const parts = [wizardType, "WizardSessionId"];
    if (userId) parts.push(userId);
    if (entityId) parts.push(entityId);
    return parts.join(":");
  }, [wizardType, userId, entityId]);

  // Initialize or restore session
  useEffect(() => {
    const sessionKey = getSessionKey();
    
    const id = requestAnimationFrame(() => {
      // Try to restore from localStorage
      const stored = localStorage.getItem(sessionKey);
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.sessionId && parsed.timestamp) {
            // Check if session is not too old (24 hours)
            const age = Date.now() - parsed.timestamp;
            if (age < 24 * 60 * 60 * 1000) {
              if (WIZARD_DEBUG) {
                console.log("[useWizardSession] Restored session:", parsed.sessionId);
              }
              setWizardSessionId(parsed.sessionId);
              setIsLoaded(true);
              return;
            }
          }
        } catch (error) {
          console.error("[useWizardSession] Failed to parse stored session:", error);
        }
      }

      // Create new session
      const newSessionId = randomId();
      const sessionData = {
        sessionId: newSessionId,
        timestamp: Date.now(),
      };
      
      localStorage.setItem(sessionKey, JSON.stringify(sessionData));
      if (WIZARD_DEBUG) {
        console.log("[useWizardSession] Created new session:", newSessionId);
      }
      setWizardSessionId(newSessionId);
      setIsLoaded(true);
    });
    
    return () => cancelAnimationFrame(id);
  }, [getSessionKey]);

  // Clear session (on discard or successful save)
  const clearSession = useCallback(async () => {
    const sessionKey = getSessionKey();
    localStorage.removeItem(sessionKey);
    
    if (WIZARD_DEBUG) {
      console.log("[useWizardSession] Cleared session:", wizardSessionId);
    }
  }, [getSessionKey, wizardSessionId]);

  return {
    wizardSessionId,
    isLoaded,
    clearSession,
  };
}
