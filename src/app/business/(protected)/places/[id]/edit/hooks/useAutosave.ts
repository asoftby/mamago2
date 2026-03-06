import { useState, useCallback, useRef } from "react";
import type { Place } from "@prisma/client";

interface UseAutosaveOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  debounceMs?: number;
}

/**
 * AUTOSAVE TEMPORARILY DISABLED
 * 
 * This hook is disabled until manual save buttons are implemented.
 * The updatePlace function is now a no-op that only logs.
 * 
 * See: PLACE_WIZARD_MANUAL_SAVE_IMPLEMENTATION.md
 */
export function useAutosave(
  placeId: string,
  options: UseAutosaveOptions = {}
) {
  const { onSuccess, onError, debounceMs = 500 } = options;
  const [isUpdating, setIsUpdating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const updatePlace = useCallback(
    async (updates: Partial<Place>) => {
      // AUTOSAVE DISABLED - No-op
      console.log("[useAutosave] DISABLED - Would have saved:", updates);
      
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Don't make API call
      // onSuccess?.(); // Don't call success callback either
      
      return;

      /* ORIGINAL AUTOSAVE CODE - COMMENTED OUT
      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Debounce
      timeoutRef.current = setTimeout(async () => {
        setIsUpdating(true);
        try {
          const res = await fetch(`/api/business/places/${placeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            console.error("Autosave failed:", {
              status: res.status,
              statusText: res.statusText,
              error: errorData,
              updates,
            });
            throw new Error(`Failed to update place: ${res.status} ${errorData.details || errorData.error || res.statusText}`);
          }

          onSuccess?.();
        } catch (error) {
          console.error("Autosave error:", error);
          onError?.(error as Error);
        } finally {
          setIsUpdating(false);
        }
      }, debounceMs);
      */
    },
    [placeId, debounceMs, onSuccess, onError]
  );

  return { updatePlace, isUpdating };
}
