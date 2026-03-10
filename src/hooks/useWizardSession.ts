/**
 * Hook for managing wizard session ID
 * Generates and persists wizardSessionId for temp media uploads
 */

import { useState, useEffect, useCallback } from "react";

interface WizardSessionOptions {
  userId?: string;
  wizardType: "place" | "activity" | "offer";
  entityId?: string; // placeId, activityId, etc. for editing existing entities
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
    
    // Try to restore from localStorage
    const stored = localStorage.getItem(sessionKey);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.sessionId && parsed.timestamp) {
          // Check if session is not too old (24 hours)
          const age = Date.now() - parsed.timestamp;
          if (age < 24 * 60 * 60 * 1000) {
            console.log("[useWizardSession] Restored session:", parsed.sessionId);
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
    const newSessionId = crypto.randomUUID();
    const sessionData = {
      sessionId: newSessionId,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(sessionKey, JSON.stringify(sessionData));
    console.log("[useWizardSession] Created new session:", newSessionId);
    setWizardSessionId(newSessionId);
    setIsLoaded(true);
  }, [getSessionKey]);

  // Clear session (on discard or successful save)
  const clearSession = useCallback(async () => {
    const sessionKey = getSessionKey();
    localStorage.removeItem(sessionKey);
    
    console.log("[useWizardSession] Cleared session:", wizardSessionId);
  }, [getSessionKey, wizardSessionId]);

  return {
    wizardSessionId,
    isLoaded,
    clearSession,
  };
}
