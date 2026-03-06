/**
 * Local Autosave Hook
 * 
 * Saves wizard state to localStorage (no DB writes)
 * Provides autosave UX without polluting database
 */

import { useState, useCallback, useRef, useEffect } from "react";

interface UseLocalAutosaveOptions<T> {
  key: string;
  debounceMs?: number;
  onSave?: (data: T) => void;
  onRestore?: (data: T) => void;
}

export function useLocalAutosave<T>({
  key,
  debounceMs = 500,
  onSave,
  onRestore,
}: UseLocalAutosaveOptions<T>) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save to localStorage
  const save = useCallback(
    (data: T) => {
      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Debounce
      timeoutRef.current = setTimeout(() => {
        setIsSaving(true);
        
        try {
          const payload = {
            data,
            timestamp: Date.now(),
          };
          
          localStorage.setItem(key, JSON.stringify(payload));
          setLastSaved(new Date());
          onSave?.(data);
          
          console.log("[useLocalAutosave] Saved to localStorage:", key);
        } catch (error) {
          console.error("[useLocalAutosave] Save error:", error);
          // Handle quota exceeded or other errors
          if (error instanceof Error && error.name === "QuotaExceededError") {
            console.error("[useLocalAutosave] localStorage quota exceeded");
          }
        } finally {
          setIsSaving(false);
        }
      }, debounceMs);
    },
    [key, debounceMs, onSave]
  );

  // Restore from localStorage
  const restore = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(key);
      
      if (!stored) {
        return null;
      }

      const parsed = JSON.parse(stored);
      
      if (!parsed.data || !parsed.timestamp) {
        return null;
      }

      // Check if data is not too old (24 hours)
      const age = Date.now() - parsed.timestamp;
      if (age > 24 * 60 * 60 * 1000) {
        console.log("[useLocalAutosave] Data too old, ignoring");
        localStorage.removeItem(key);
        return null;
      }

      console.log("[useLocalAutosave] Restored from localStorage:", key);
      onRestore?.(parsed.data);
      setLastSaved(new Date(parsed.timestamp));
      
      return parsed.data;
    } catch (error) {
      console.error("[useLocalAutosave] Restore error:", error);
      return null;
    }
  }, [key, onRestore]);

  // Clear localStorage
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setLastSaved(null);
      console.log("[useLocalAutosave] Cleared localStorage:", key);
    } catch (error) {
      console.error("[useLocalAutosave] Clear error:", error);
    }
  }, [key]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    save,
    restore,
    clear,
    isSaving,
    lastSaved,
  };
}
