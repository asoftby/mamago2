"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { submitReviewDecision, applyImportEventRecord } from "../../../actions";
import { DeleteImportedRecordButton } from "./ReviewDetailActions";
import type { PlaceMatchCandidate, EventMatchCandidate } from "@/server/modules/import/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Decision = "APPROVED_CREATE" | "APPROVED_UPDATE" | "APPROVED_MERGE";

type UiState = "deciding" | "executing" | "done" | "published";

interface Props {
  taskId: string;
  importedRecordId: string;
  suggestedAction?: string | null;
  candidates: (PlaceMatchCandidate | EventMatchCandidate)[];
  venueName?: string | null;
  /** Уже применённый результат (страница открыта повторно) */
  initialApplyResult?: { activityId?: string | null; activitySlug?: string | null } | null;
  /** Уже сохранённое решение */
  initialDecision?: Decision | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const DECISION_OPTIONS: {
  value: Decision;
  label: string;
  description: string;
  requiresTarget: boolean;
}[] = [
  {
    value: "APPROVED_CREATE",
    label: "Создать новое событие",
    description: "Запись будет добавлена как новый Activity",
    requiresTarget: false,
  },
  {
    value: "APPROVED_UPDATE",
    label: "Обновить существующее",
    description: "Данные будут применены к выбранному Activity",
    requiresTarget: true,
  },
  {
    value: "APPROVED_MERGE",
    label: "Объединить с существующим",
    description: "Записи будут объединены с выбранным Activity",
    requiresTarget: true,
  },
];

const ACTION_BUTTON: Record<Decision, string> = {
  APPROVED_CREATE: "Создать событие",
  APPROVED_UPDATE: "Обновить событие",
  APPROVED_MERGE: "Объединить",
};

const SUCCESS_TITLE: Record<Decision, string> = {
  APPROVED_CREATE: "Событие создано",
  APPROVED_UPDATE: "Событие обновлено",
  APPROVED_MERGE: "События объединены",
};

const DECISION_LABEL: Record<Decision, string> = {
  APPROVED_CREATE: "Создать новый Activity",
  APPROVED_UPDATE: "Обновить существующий Activity",
  APPROVED_MERGE: "Объединить с существующим Activity",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function EventReviewWorkflow({
  taskId,
  importedRecordId,
  suggestedAction,
  candidates,
  venueName,
  initialApplyResult,
  initialDecision,
}: Props) {
  const alreadyDone = !!initialApplyResult?.activityId;

  const [uiState, setUiState] = useState<UiState>(alreadyDone ? "done" : "deciding");
  const [selected, setSelected] = useState<Decision | null>(initialDecision ?? null);
  const [targetCandidateId, setTargetCandidateId] = useState("");
  const [notes, setNotes] = useState("");
  const [autoPublish, setAutoPublish] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moderationLoading, setModerationLoading] = useState<"APPROVE" | "REJECT" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string | null>(initialApplyResult?.activityId ?? null);

  const config = selected ? DECISION_OPTIONS.find((d) => d.value === selected) : null;
  const needsTarget = config?.requiresTarget ?? false;
  const canExecute = selected !== null && (!needsTarget || targetCandidateId !== "");

  const venueText = venueName ? `«${venueName}»` : "Будет выбрана автоматически";

  // ─── Execute: save decision + apply in one shot ───────────────────────────

  async function handleExecute() {
    if (!selected || !canExecute || loading) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Save decision
      const decisionRes = await submitReviewDecision(taskId, {
        decision: selected,
        targetEntityId: needsTarget && targetCandidateId ? targetCandidateId : null,
        targetEntityType: needsTarget && targetCandidateId ? "ACTIVITY" : null,
        selectedCandidateId: targetCandidateId || null,
        notes: notes.trim() || null,
      });

      if (!decisionRes.success) {
        setError(decisionRes.error ?? "Не удалось сохранить решение");
        return;
      }

      // 2. Apply immediately
      const applyRes = await applyImportEventRecord(importedRecordId);

      if (!applyRes.success) {
        setError(applyRes.error ?? "Не удалось выполнить действие");
        return;
      }

      const newActivityId = applyRes.activityId ?? null;
      setActivityId(newActivityId);

      // 3. Auto-publish if toggled
      if (autoPublish && newActivityId) {
        const pubRes = await fetch(`/api/admin/moderation/events/${newActivityId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action: "APPROVE" }),
        });
        if (pubRes.ok) {
          setUiState("published");
          toast.success("Событие создано и опубликовано");
          return;
        }
      }

      setUiState("done");
      toast.success(SUCCESS_TITLE[selected] ?? "Готово");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }

  // ─── Moderation actions ───────────────────────────────────────────────────

  async function handleModeration(action: "APPROVE" | "REJECT") {
    if (!activityId) return;
    setModerationLoading(action);
    try {
      const res = await fetch(`/api/admin/moderation/events/${activityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action,
          comment: action === "REJECT" ? "Отклонено после import review." : undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Ошибка");
      if (action === "APPROVE") {
        setUiState("published");
        toast.success("Событие опубликовано");
      } else {
        toast.success("Событие отклонено");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка модерации");
    } finally {
      setModerationLoading(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const isDone = uiState === "done" || uiState === "published";

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 border-b ${isDone ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isDone && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
            <h2 className={`text-sm font-semibold ${isDone ? "text-emerald-900" : "text-slate-800"}`}>
              {isDone
                ? (uiState === "published" ? "Событие опубликовано" : (selected ? SUCCESS_TITLE[selected] : "Готово"))
                : "Принять решение"
              }
            </h2>
          </div>
          {suggestedAction && !isDone && (
            <span className="text-xs text-slate-500">
              Рекомендация: <span className="font-medium text-slate-700">{suggestedAction}</span>
            </span>
          )}
        </div>
        {isDone && (
          <p className="text-xs text-emerald-700 mt-0.5 ml-6">
            Событие добавлено в каталог и готово к публикации
          </p>
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* ── DECIDING state ── */}
        {uiState === "deciding" && (
          <>
            {/* Decision options */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {DECISION_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    setSelected(d.value);
                    if (!d.requiresTarget) setTargetCandidateId("");
                    setError(null);
                  }}
                  className={`rounded-lg border-2 p-3 text-left transition ${
                    selected === d.value
                      ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{d.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{d.description}</div>
                </button>
              ))}
            </div>

            {/* Target candidate selector */}
            {needsTarget && candidates.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Выберите существующий Activity <span className="text-red-500">*</span>
                </label>
                <div className="space-y-1.5">
                  {candidates.map((c) => {
                    const hasRisk =
                      "signals" in c &&
                      "possibleOccurrenceRisk" in c.signals &&
                      (c.signals as { possibleOccurrenceRisk: boolean }).possibleOccurrenceRisk;
                    return (
                      <label
                        key={c.entityId}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                          targetCandidateId === c.entityId
                            ? "border-slate-900 bg-slate-50"
                            : hasRisk
                              ? "border-orange-200 bg-orange-50 hover:bg-orange-100"
                              : "border-slate-200 hover:bg-slate-50"
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
                          <div className="flex flex-wrap items-center gap-1.5">
                            {hasRisk && (
                              <span className="rounded bg-orange-200 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                                ⚠ occurrence risk
                              </span>
                            )}
                            <span className="text-sm font-medium text-slate-900">{c.entityTitle}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500">
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
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Нет кандидатов для выбора. Используйте «Создать новое».
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Комментарий (необязательно)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Причина решения, замечания..."
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            {/* Summary preview — показывается только когда выбрано решение */}
            {selected && (
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-1.5 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Что произойдёт</p>
                <div className="flex gap-2">
                  <span className="w-20 shrink-0 text-slate-500">Тип</span>
                  <span className="font-medium text-slate-900">Событие</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-20 shrink-0 text-slate-500">Действие</span>
                  <span className="font-medium text-slate-900">{DECISION_LABEL[selected]}</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-20 shrink-0 text-slate-500">Площадка</span>
                  <span className="font-medium text-slate-900">
                    {venueText}
                    {!venueName && <span className="ml-1 text-xs text-slate-400">(авто)</span>}
                  </span>
                </div>
              </div>
            )}

            {/* Auto-publish toggle */}
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-slate-900"
              />
              <span className="text-sm text-slate-700">Авто-публиковать после создания</span>
            </label>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleExecute}
                disabled={!canExecute || loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Выполняем…" : (selected ? ACTION_BUTTON[selected] : "Выбрать действие")}
              </button>
              <DeleteImportedRecordButton
                importedRecordId={importedRecordId}
                isApplied={false}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm text-red-700 transition hover:bg-red-50"
              />
            </div>
          </>
        )}

        {/* ── DONE / PUBLISHED state ── */}
        {(uiState === "done" || uiState === "published") && (
          <>
            {/* Result summary */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <span className="w-24 shrink-0 text-slate-500">Тип</span>
                <span className="font-medium text-slate-900">Событие</span>
              </div>
              {selected && (
                <div className="flex gap-2">
                  <span className="w-24 shrink-0 text-slate-500">Действие</span>
                  <span className="font-medium text-slate-900">{DECISION_LABEL[selected]}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="w-24 shrink-0 text-slate-500">Площадка</span>
                <span className="font-medium text-slate-900">{venueText}</span>
              </div>
              {activityId && (
                <div className="flex gap-2 border-t border-slate-200 pt-1.5">
                  <span className="w-24 shrink-0 text-slate-500">Activity ID</span>
                  <span className="break-all font-mono text-xs text-slate-700">{activityId}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            {uiState === "done" && activityId && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleModeration("APPROVE")}
                  disabled={moderationLoading !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {moderationLoading === "APPROVE" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {moderationLoading === "APPROVE" ? "Публикуем…" : "Опубликовать"}
                </button>
                <Link
                  href={`/editor/event/${activityId}/edit`}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  Открыть карточку
                </Link>
                <button
                  type="button"
                  onClick={() => void handleModeration("REJECT")}
                  disabled={moderationLoading !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {moderationLoading === "REJECT" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Отклонить
                </button>
              </div>
            )}

            {uiState === "published" && activityId && (
              <Link
                href={`/editor/event/${activityId}/edit`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                Открыть карточку
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
