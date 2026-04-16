"use client";

import { useState } from "react";
import { triggerImportRun } from "../../actions";

interface Props {
  sourceId: string;
}

export function TriggerRunButton({ sourceId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    runId?: string;
    error?: string;
    stats?: {
      totalFetched: number;
      totalParsed: number;
      totalCreated: number;
      totalSkipped: number;
      totalErrors: number;
      normalizeSuccess: number;
      normalizeFailed: number;
      matchMatched: number;
      matchNoMatch: number;
      matchAmbiguous: number;
      reviewTasksCreated: number;
    };
  } | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await triggerImportRun(sourceId);
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center rounded px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? "Запуск…" : "▶ Запустить"}
      </button>

      {result && (
        <div
          className={`text-xs rounded p-2 mt-1 ${result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
        >
          {result.success ? (
            <>
              <div className="font-medium">Завершено</div>
              {result.stats && (
                <div className="mt-0.5 space-y-0.5">
                  <div>fetched: {result.stats.totalFetched} / parsed: {result.stats.totalParsed}</div>
                  <div>created: {result.stats.totalCreated} / skipped: {result.stats.totalSkipped}</div>
                  <div>normalized: {result.stats.normalizeSuccess} / errors: {result.stats.totalErrors}</div>
                  <div className="border-t border-green-200 pt-0.5 mt-0.5">
                    matched: {result.stats.matchMatched} / no match: {result.stats.matchNoMatch} / ambiguous: {result.stats.matchAmbiguous}
                  </div>
                  {result.stats.reviewTasksCreated > 0 && (
                    <div className="font-medium">
                      📋 review tasks: {result.stats.reviewTasksCreated}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div>Ошибка: {result.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
