"use client";

import { useCallback, useState } from "react";
import { toast } from "@/lib/toast";
import type { EnrichmentResult } from "@/lib/ai/enrichEvent";

export interface UseAiEnrichmentOptions {
  importedRecordId?: string | null;
  activityId?: string | null;
  initialEnrichment?: EnrichmentResult | null;
}

export interface UseAiEnrichmentReturn {
  enrichment: EnrichmentResult | null;
  isLoading: boolean;
  isDone: boolean;
  manualOverrides: string[];
  markManualOverride: (field: string) => void;
  run: () => Promise<void>;
}

export function useAiEnrichment({
  importedRecordId,
  activityId,
  initialEnrichment,
}: UseAiEnrichmentOptions): UseAiEnrichmentReturn {
  const [enrichment, setEnrichment] = useState<EnrichmentResult | null>(
    initialEnrichment || null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(Boolean(initialEnrichment));
  const [manualOverrides, setManualOverrides] = useState<string[]>([]);

  const markManualOverride = useCallback((field: string) => {
    setManualOverrides((prev) => (prev.includes(field) ? prev : [...prev, field]));
  }, []);

  const run = useCallback(async () => {
    if (!importedRecordId && !activityId) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/ai/enrich-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importedRecordId: importedRecordId ?? undefined,
          activityId: activityId ?? undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: EnrichmentResult | null;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Не удалось определить поля");
      }

      setEnrichment(payload.result ?? null);
      setIsDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось определить поля");
    } finally {
      setIsLoading(false);
    }
  }, [activityId, importedRecordId]);

  return {
    enrichment,
    isLoading,
    isDone,
    manualOverrides,
    markManualOverride,
    run,
  };
}
