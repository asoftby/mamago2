"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { submitReviewDecision } from "../../../actions";
import type { PlaceMatchCandidate, EventMatchCandidate } from "@/server/modules/import/types";
import { DeleteImportedRecordButton } from "./ReviewDetailActions";

type Decision = "APPROVED_CREATE" | "APPROVED_UPDATE" | "APPROVED_MERGE";
type EntityType = "PLACE" | "EVENT";

interface Props {
  taskId: string;
  importedRecordId: string;
  isApplied: boolean;
  entityType: EntityType;
  suggestedAction?: string;
  candidates: (PlaceMatchCandidate | EventMatchCandidate)[];
  onSaved?: (data: {
    task: {
      id: string;
      status: string;
      suggestedAction: string | null;
      reviewedAt: string | null;
      priority: number;
      notes: string | null;
      reviewerUserId: string | null;
      decision: string | null;
    };
    importedRecord: {
      id: string;
      reviewStatus: string;
      reviewDecision: {
        decision: "APPROVED_CREATE" | "APPROVED_UPDATE" | "APPROVED_MERGE" | "REJECTED" | "DEFERRED";
        targetEntityId: string | null;
        targetEntityType: "PLACE" | "ACTIVITY" | null;
        selectedCandidateId?: string | null;
        notes?: string | null;
        recovery?: {
          detachedAt: string;
          invalidLinkedEntityId: string;
          invalidLinkedEntityType: "PLACE" | "ACTIVITY";
          reason: string;
        } | null;
        reviewedAt: string;
        reviewerUserId: string;
      } | null;
      publishedPlaceId: string | null;
      publishedActivityId: string | null;
    };
  }) => void;
}

// Labels adapt to entity type
function getDecisionConfig(entityType: EntityType) {
  const isEvent = entityType === "EVENT";
  return [
    {
      value: "APPROVED_CREATE" as Decision,
      label: isEvent ? "✅ Создать новое событие" : "✅ Создать новое место",
      description: isEvent ? "Запись будет опубликована как новый Activity" : "Запись будет опубликована как новый Place",
      requiresTarget: false,
      className: "border-blue-300 bg-blue-50 hover:bg-blue-100",
    },
    {
      value: "APPROVED_UPDATE" as Decision,
      label: isEvent ? "🔄 Обновить существующее событие" : "🔄 Обновить существующее место",
      description: isEvent ? "Данные будут применены к выбранному Activity" : "Данные будут применены к выбранному Place",
      requiresTarget: true,
      className: "border-yellow-300 bg-yellow-50 hover:bg-yellow-100",
    },
    {
      value: "APPROVED_MERGE" as Decision,
      label: isEvent ? "🔗 Объединить с существующим событием" : "🔗 Объединить с существующим местом",
      description: isEvent ? "Записи будут объединены с выбранным Activity" : "Записи будут объединены с выбранным Place",
      requiresTarget: true,
      className: "border-purple-300 bg-purple-50 hover:bg-purple-100",
    },
  ];
}

export function ReviewDecisionPanel({
  taskId,
  importedRecordId,
  isApplied,
  entityType,
  suggestedAction,
  candidates,
  onSaved,
}: Props) {
  const [selected, setSelected] = useState<Decision | null>(null);
  const [targetCandidateId, setTargetCandidateId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const DECISION_CONFIG = getDecisionConfig(entityType);
  const config = selected ? DECISION_CONFIG.find((d) => d.value === selected) : null;
  const needsTarget = config?.requiresTarget ?? false;
  const canSubmit = selected !== null && (!needsTarget || targetCandidateId !== "");

  async function handleSubmit() {
    if (!selected || !canSubmit) return;
    setLoading(true);
    setError(null);

    const targetEntityId = needsTarget && targetCandidateId ? targetCandidateId : null;
    const targetEntityType = targetEntityId
      ? (entityType === "EVENT" ? "ACTIVITY" : "PLACE")
      : null;

    const result = await submitReviewDecision(taskId, {
      decision: selected,
      targetEntityId,
      targetEntityType: targetEntityType as "PLACE" | "ACTIVITY" | null,
      selectedCandidateId: targetCandidateId || null,
      notes: notes.trim() || null,
    });

    setLoading(false);

    if (result.success) {
      toast.success("Решение сохранено");
      if (result.data) {
        onSaved?.(result.data);
      }
    } else {
      const message = result.error ?? "Unknown error";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Принять решение
        </h2>
        {suggestedAction && (
          <p className="text-xs text-gray-500 mt-0.5">
            Рекомендация системы:{" "}
            <span className="font-medium text-gray-700">{suggestedAction}</span>
          </p>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Decision buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DECISION_CONFIG.map((d) => (
            <button
              key={d.value}
              onClick={() => {
                setSelected(d.value);
                if (!d.requiresTarget) setTargetCandidateId("");
              }}
              className={`rounded-lg border-2 p-3 text-left transition ${
                selected === d.value
                  ? d.className + " ring-2 ring-offset-1 ring-blue-400"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="font-medium text-sm text-gray-900">{d.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{d.description}</div>
            </button>
          ))}
        </div>

        {/* Target candidate selector */}
        {needsTarget && candidates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Выберите существующий{entityType === "EVENT" ? " Activity" : " Place"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {candidates.map((c) => {
                const hasOccurrenceRisk =
                  "signals" in c &&
                  "possibleOccurrenceRisk" in c.signals &&
                  (c.signals as { possibleOccurrenceRisk: boolean }).possibleOccurrenceRisk;

                return (
                  <label
                    key={c.entityId}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
                      targetCandidateId === c.entityId
                        ? "border-blue-400 bg-blue-50"
                        : hasOccurrenceRisk
                          ? "border-orange-200 bg-orange-50 hover:bg-orange-100"
                          : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetCandidate"
                      value={c.entityId}
                      checked={targetCandidateId === c.entityId}
                      onChange={() => setTargetCandidateId(c.entityId)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {hasOccurrenceRisk && (
                          <span className="text-xs font-medium text-orange-700 bg-orange-200 rounded px-1.5 py-0.5">
                            ⚠ occurrence risk
                          </span>
                        )}
                        <span className="font-medium text-sm text-gray-900">{c.entityTitle}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        score: {(c.score * 100).toFixed(0)}% — {c.reason}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {needsTarget && candidates.length === 0 && (
          <div className="rounded bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            Нет кандидатов для выбора. Используйте «Создать новое».
            Если запись не нужна — удалите её через кнопку в шапке.
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Комментарий (необязательно)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Причина решения, замечания..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>

        {error && (
          <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="rounded-lg px-5 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? "Сохранение…" : "Сохранить решение"}
          </button>
          <p className="text-xs text-gray-400">
            {entityType === "EVENT"
              ? "Activity не будет изменена до фазы публикации"
              : "Place не будет изменён до фазы публикации"}
          </p>
          <DeleteImportedRecordButton
            importedRecordId={importedRecordId}
            isApplied={isApplied}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-50"
          />
        </div>
      </div>
    </div>
  );
}
