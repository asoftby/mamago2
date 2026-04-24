"use client";

import { useState } from "react";
import { applyImportEventRecord } from "../../../actions";
import { ActivityModerationShortcut } from "./ActivityModerationShortcut";

interface Props {
  importedRecordId: string;
  decision: string;
  targetEntityId?: string | null;
  /** Нормализованные данные для диагностики */
  typeCandidate?: string | null;
  scheduleModeCandidate?: string | null;
  venueName?: string | null;
}

export function EventApplyPanel({
  importedRecordId,
  decision,
  targetEntityId,
  typeCandidate,
  scheduleModeCandidate,
  venueName,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    activityId?: string;
    activitySlug?: string;
    appliedFields?: string[];
    skippedFields?: string[];
    emptyFields?: string[];
    error?: string;
  } | null>(null);

  async function handleApply() {
    if (loading || result?.success) return;
    setLoading(true);
    setResult(null);
    const res = await applyImportEventRecord(importedRecordId);
    setLoading(false);
    setResult(res);
  }

  const decisionLabel: Record<string, string> = {
    APPROVED_CREATE: "Создать новый Activity",
    APPROVED_UPDATE: "Обновить существующий Activity",
    APPROVED_MERGE:  "Объединить с существующим Activity",
  };

  // Диагностика: предупреждения о fallback значениях
  const warnings: string[] = [];
  const KNOWN_TYPES = ["EVENT", "PERMANENT", "COURSE", "ROUTE", "OFFER"];
  const KNOWN_MODES = ["ONE_TIME", "MULTI_DATE", "RECURRING", "ON_DEMAND", "ALWAYS"];
  if (!typeCandidate || !KNOWN_TYPES.includes(typeCandidate.toUpperCase())) {
    warnings.push(`type "${typeCandidate ?? "не определён"}" → будет использован fallback: EVENT`);
  }
  if (!scheduleModeCandidate || !KNOWN_MODES.includes(scheduleModeCandidate.toUpperCase())) {
    warnings.push(`scheduleMode "${scheduleModeCandidate ?? "не определён"}" → будет использован fallback: ONE_TIME`);
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 overflow-hidden">
      <div className="px-4 py-3 bg-violet-100 border-b border-violet-200">
        <h2 className="text-sm font-semibold text-violet-900 uppercase tracking-wide">
          Применить решение — EVENT
        </h2>
        <p className="text-xs text-violet-700 mt-0.5">
          Решение одобрено. Нажмите кнопку для применения в каталог.
        </p>
      </div>

      <div className="p-4 space-y-3">
        <div className="text-sm text-violet-900">
          <span className="font-medium">Действие:</span>{" "}
          {decisionLabel[decision] ?? decision}
          {targetEntityId && (
            <span className="text-violet-700 ml-1 text-xs">(target: {targetEntityId})</span>
          )}
        </div>

        {/* Venue info */}
        {venueName && (
          <div className="rounded bg-violet-100 border border-violet-200 px-3 py-2 text-xs text-violet-800">
            🏛 Площадка: <span className="font-medium">{venueName}</span>
            <span className="text-violet-600 ml-1">— будет выполнен поиск Place для привязки</span>
          </div>
        )}

        {/* Mapping warnings */}
        {warnings.length > 0 && (
          <div className="rounded bg-yellow-50 border border-yellow-200 px-3 py-2 space-y-1">
            <div className="text-xs font-medium text-yellow-800">⚠ Fallback значения:</div>
            {warnings.map((w, i) => (
              <div key={i} className="text-xs text-yellow-700">{w}</div>
            ))}
          </div>
        )}

        {!result && (
          <button
            onClick={handleApply}
            disabled={loading}
            className="rounded-lg px-5 py-2 text-sm font-medium bg-violet-700 text-white hover:bg-violet-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? "Применение…" : "▶ Применить в каталог"}
          </button>
        )}

        {result?.success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
            <div className="font-medium text-green-800 text-sm">✅ Применено успешно</div>
            {result.activityId && (
              <div className="text-xs text-green-700">
                Activity ID: <span className="font-mono">{result.activityId}</span>
              </div>
            )}
            {result.activitySlug && (
              <div className="text-xs text-green-700">
                Slug события: <span className="font-mono">{result.activitySlug}</span>
              </div>
            )}
            {result.activityId && (
              <div className="pt-2">
                <ActivityModerationShortcut activityId={result.activityId} />
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
                <span className="font-medium">Пропущены (non-empty):</span>{" "}
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

        <p className="text-xs text-violet-600">
          Activity создаётся со статусом PENDING (на модерацию).
          Изображения по URL остаются в записи импорта; в медиатеку их можно добавить на review или в
          редакторе события (шаг «Медиа»).
          scheduleJson содержит минимальную структуру из startAt/endAt.
        </p>
      </div>
    </div>
  );
}
