"use client";

import { useState } from "react";
import { applyImportRecord } from "../../../actions";

interface Props {
  importedRecordId: string;
  decision: string;
  targetEntityId?: string | null;
}

export function ApplyPanel({ importedRecordId, decision, targetEntityId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    placeId?: string;
    appliedFields?: string[];
    skippedFields?: string[];
    emptyFields?: string[];
    error?: string;
  } | null>(null);

  async function handleApply() {
    if (loading || result?.success) return;
    setLoading(true);
    setResult(null);
    const res = await applyImportRecord(importedRecordId);
    setLoading(false);
    setResult(res);
  }

  const decisionLabel: Record<string, string> = {
    APPROVED_CREATE: "Создать новый Place",
    APPROVED_UPDATE: "Обновить существующий Place",
    APPROVED_MERGE:  "Объединить с существующим Place",
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 overflow-hidden">
      <div className="px-4 py-3 bg-blue-100 border-b border-blue-200">
        <h2 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
          Применить решение
        </h2>
        <p className="text-xs text-blue-700 mt-0.5">
          Решение одобрено. Нажмите кнопку для применения в каталог.
        </p>
      </div>

      <div className="p-4 space-y-3">
        <div className="text-sm text-blue-900">
          <span className="font-medium">Действие:</span>{" "}
          {decisionLabel[decision] ?? decision}
          {targetEntityId && (
            <span className="text-blue-700 ml-1 text-xs">(target: {targetEntityId})</span>
          )}
        </div>

        {!result && (
          <button
            onClick={handleApply}
            disabled={loading}
            className="rounded-lg px-5 py-2 text-sm font-medium bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? "Применение…" : "▶ Применить в каталог"}
          </button>
        )}

        {result?.success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
            <div className="font-medium text-green-800 text-sm">
              ✅ Применено успешно
            </div>
            {result.placeId && (
              <div className="text-xs text-green-700">
                Place ID:{" "}
                <a
                  href={`/admin/content/places/${result.placeId}`}
                  className="font-mono underline hover:text-green-900"
                >
                  {result.placeId}
                </a>
              </div>
            )}
            {result.appliedFields && result.appliedFields.length > 0 && (
              <div className="text-xs text-green-700">
                <span className="font-medium">Применены поля:</span>{" "}
                {result.appliedFields.join(", ")}
              </div>
            )}
            {result.skippedFields && result.skippedFields.length > 0 && (
              <div className="text-xs text-yellow-700">
                <span className="font-medium">Пропущены (override/non-empty):</span>{" "}
                {result.skippedFields.join(", ")}
              </div>
            )}
            {result.emptyFields && result.emptyFields.length > 0 && (
              <div className="text-xs text-gray-500">
                <span className="font-medium">Пустые поля:</span>{" "}
                {result.emptyFields.join(", ")}
              </div>
            )}
          </div>
        )}

        {result && !result.success && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span className="font-medium">Ошибка:</span> {result.error}
          </div>
        )}

        <p className="text-xs text-blue-600">
          После применения Place будет создан/обновлён со статусом PENDING (на модерацию).
          imageUrls не загружаются — media ingestion в следующей фазе.
        </p>
      </div>
    </div>
  );
}
