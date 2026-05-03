"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { approveImportedEventRecordAndOpen } from "../../../actions";
import { DeleteImportedRecordButton } from "./ReviewDetailActions";
import type { PlaceMatchCandidate, EventMatchCandidate } from "@/server/modules/import/types";

type Decision = "APPROVED_CREATE" | "APPROVED_UPDATE" | "APPROVED_MERGE";

interface Props {
  taskId: string;
  importedRecordId: string;
  suggestedAction?: string | null;
  taskStatus?: string | null;
  candidates: (PlaceMatchCandidate | EventMatchCandidate)[];
  venueName?: string | null;
  initialApplyResult?: { activityId?: string | null; activitySlug?: string | null } | null;
  initialDecision?: Decision | null;
  initialTargetEntityId?: string | null;
}

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
    description: "Запись будет объединена с выбранным Activity",
    requiresTarget: true,
  },
];

const DECISION_LABEL: Record<Decision, string> = {
  APPROVED_CREATE: "Создать новый Activity",
  APPROVED_UPDATE: "Обновить существующий Activity",
  APPROVED_MERGE: "Объединить с существующим Activity",
};

const LOCKED_STATUS = new Set(["COMPLETED", "CANCELLED"]);

export function EventReviewWorkflow({
  taskId,
  importedRecordId,
  suggestedAction,
  taskStatus,
  candidates,
  venueName,
  initialApplyResult,
  initialDecision,
  initialTargetEntityId,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Decision | null>(initialDecision ?? null);
  const [targetCandidateId, setTargetCandidateId] = useState(initialTargetEntityId ?? "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string | null>(initialApplyResult?.activityId ?? null);
  const [activitySlug, setActivitySlug] = useState<string | null>(initialApplyResult?.activitySlug ?? null);

  const config = selected ? DECISION_OPTIONS.find((d) => d.value === selected) : null;
  const needsTarget = config?.requiresTarget ?? false;
  const alreadyCreated = !!activityId;
  const decisionLocked = LOCKED_STATUS.has(taskStatus ?? "") && !!initialDecision && !alreadyCreated;
  const canExecute = alreadyCreated || (selected !== null && (!needsTarget || targetCandidateId !== ""));
  const venueText = venueName ? `«${venueName}»` : "Будет выбрана автоматически";

  const editHref = useMemo(() => {
    if (!activityId) return null;
    const params = new URLSearchParams({
      returnTo: "/admin/import/review",
      importedRecordId,
    });
    return `/editor/event/${activityId}/edit?${params.toString()}`;
  }, [activityId, importedRecordId]);

  const primaryLabel = alreadyCreated
    ? "Открыть карточку"
    : selected === "APPROVED_CREATE"
      ? "Создать карточку и открыть"
      : selected
        ? "Применить и открыть карточку"
        : "Выберите действие";

  const loadingLabel = selected === "APPROVED_CREATE" ? "Создаём карточку…" : "Применяем…";

  async function handlePrimaryAction() {
    if (loading) return;
    if (alreadyCreated && editHref) {
      router.push(editHref);
      return;
    }
    if (!selected || !canExecute) return;

    setLoading(true);
    setError(null);
    try {
      const result = await approveImportedEventRecordAndOpen({
        taskId,
        importedRecordId,
        decision: selected,
        targetEntityId: needsTarget ? targetCandidateId : null,
        targetEntityType: needsTarget ? "ACTIVITY" : null,
        selectedCandidateId: needsTarget ? targetCandidateId : null,
        notes: notes.trim() || null,
      });

      if (!result.success || !result.activityId || !result.editHref) {
        setError(result.error ?? "Не удалось открыть карточку");
        return;
      }

      setActivityId(result.activityId);
      setActivitySlug(result.activitySlug ?? null);

      toast.success(
        result.reusedExisting
          ? "Карточка уже создана. Открываем редактор…"
          : "Карточка создана. Открываем редактор…",
      );
      router.push(result.editHref);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className={`border-b px-4 py-3 ${alreadyCreated ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {alreadyCreated ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : null}
            <h2 className={`text-sm font-semibold ${alreadyCreated ? "text-emerald-900" : "text-slate-800"}`}>
              {alreadyCreated ? "Карточка готова" : "Принять решение"}
            </h2>
          </div>
          {suggestedAction && !alreadyCreated ? (
            <span className="text-xs text-slate-500">
              Рекомендация: <span className="font-medium text-slate-700">{suggestedAction}</span>
            </span>
          ) : null}
        </div>
        {alreadyCreated ? (
          <p className="ml-6 mt-0.5 text-xs text-emerald-700">
            Activity уже создан. Можно сразу открыть редактор без повторного применения.
          </p>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        {!alreadyCreated ? (
          <>
            {!decisionLocked ? (
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
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Решение уже сохранено. Осталось применить его и открыть карточку.
              </div>
            )}

            {needsTarget && candidates.length > 0 ? (
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
                            {hasRisk ? (
                              <span className="rounded bg-orange-200 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                                occurrence risk
                              </span>
                            ) : null}
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
            ) : null}

            {needsTarget && candidates.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Нет кандидатов для выбора. Используйте «Создать новое».
              </div>
            ) : null}

            {!decisionLocked ? (
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
            ) : null}

            {selected ? (
              <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Что произойдёт</p>
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
                  <span className="font-medium text-slate-900">{venueText}</span>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handlePrimaryAction}
                disabled={!canExecute || loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? loadingLabel : primaryLabel}
              </button>
              <DeleteImportedRecordButton
                importedRecordId={importedRecordId}
                isApplied={false}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm text-red-700 transition hover:bg-red-50"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex gap-2">
                <span className="w-24 shrink-0 text-slate-500">Тип</span>
                <span className="font-medium text-slate-900">Событие</span>
              </div>
              {selected ? (
                <div className="flex gap-2">
                  <span className="w-24 shrink-0 text-slate-500">Действие</span>
                  <span className="font-medium text-slate-900">{DECISION_LABEL[selected]}</span>
                </div>
              ) : null}
              <div className="flex gap-2">
                <span className="w-24 shrink-0 text-slate-500">Площадка</span>
                <span className="font-medium text-slate-900">{venueText}</span>
              </div>
              {activityId ? (
                <div className="flex gap-2 border-t border-slate-200 pt-1.5">
                  <span className="w-24 shrink-0 text-slate-500">Activity ID</span>
                  <span className="break-all font-mono text-xs text-slate-700">{activityId}</span>
                </div>
              ) : null}
              {activitySlug ? (
                <div className="flex gap-2">
                  <span className="w-24 shrink-0 text-slate-500">Slug</span>
                  <span className="break-all font-mono text-xs text-slate-700">{activitySlug}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {editHref ? (
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Открыть карточку
                </button>
              ) : null}

              <Link
                href="/admin/import/review"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                Назад к списку
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
