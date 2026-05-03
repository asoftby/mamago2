"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { applyImportEventRecord } from "../../../actions";
import { DeleteImportedRecordButton } from "./ReviewDetailActions";

interface Props {
  importedRecordId: string;
  decision: string;
  targetEntityId?: string | null;
  initialApplyResult?: {
    activityId?: string | null;
    activitySlug?: string | null;
  } | null;
  /** Нормализованные данные для диагностики */
  typeCandidate?: string | null;
  scheduleModeCandidate?: string | null;
  venueName?: string | null;
}

export function EventApplyPanel({
  importedRecordId,
  decision,
  targetEntityId: _targetEntityId,
  initialApplyResult,
  typeCandidate,
  scheduleModeCandidate,
  venueName,
}: Props) {
  const [uiState, setUiState] = useState<"ready_to_create" | "created" | "published">(
    initialApplyResult?.activityId ? "created" : "ready_to_create",
  );
  const [loading, setLoading] = useState(false);
  const [moderationLoading, setModerationLoading] = useState<"APPROVE" | "REJECT" | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    activityId?: string;
    activitySlug?: string;
    appliedFields?: string[];
    skippedFields?: string[];
    emptyFields?: string[];
    error?: string;
  } | null>(
    initialApplyResult?.activityId
      ? {
          success: true,
          activityId: initialApplyResult.activityId ?? undefined,
          activitySlug: initialApplyResult.activitySlug ?? undefined,
        }
      : null,
  );

  async function handleApply() {
    if (loading || result?.success) return;
    setLoading(true);
    setResult(null);
    const res = await applyImportEventRecord(importedRecordId);
    setLoading(false);
    setResult(res);
    if (res.success) setUiState("created");
  }

  async function handleModeration(action: "APPROVE" | "REJECT") {
    if (!result?.activityId) return;
    setModerationLoading(action);
    try {
      const response = await fetch(`/api/admin/moderation/events/${result.activityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action,
          comment: action === "REJECT" ? "Отклонено после import review." : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Не удалось выполнить действие");
      }
      if (action === "APPROVE") {
        setUiState("published");
        toast.success("Событие опубликовано");
      } else {
        toast.success("Событие отклонено");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка модерации");
    } finally {
      setModerationLoading(null);
    }
  }

  const decisionLabel: Record<string, string> = {
    APPROVED_CREATE: "Создать новый Activity",
    APPROVED_UPDATE: "Обновить существующий Activity",
    APPROVED_MERGE:  "Объединить с существующим Activity",
  };
  const shouldShowPlaceHint = !venueName || !typeCandidate || !scheduleModeCandidate;

  return (
    <div className="rounded-[18px] border border-stone-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)] overflow-hidden">
      <div
        className={
          uiState === "ready_to_create"
            ? "border-b border-stone-200 bg-stone-50 px-5 py-4"
            : "border-b border-emerald-200/80 bg-emerald-50/70 px-5 py-4"
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={
              uiState === "ready_to_create"
                ? "mt-0.5 rounded-full bg-stone-200 p-1.5"
                : "mt-0.5 rounded-full bg-emerald-100 p-1.5"
            }
          >
            {uiState === "ready_to_create" ? (
              <Circle className="h-4 w-4 text-stone-700" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden />
            )}
          </div>
          <div>
            {uiState === "ready_to_create" && (
              <>
                <h2 className="text-base font-semibold text-stone-900">Готово к добавлению</h2>
                <p className="mt-0.5 text-sm text-stone-700">Событие будет создано в каталоге</p>
              </>
            )}
            {uiState === "created" && (
              <>
                <h2 className="text-base font-semibold text-emerald-900">Событие создано</h2>
                <p className="mt-0.5 text-sm text-emerald-800/90">
                  Событие добавлено в каталог и готово к публикации
                </p>
              </>
            )}
            {uiState === "published" && (
              <>
                <h2 className="text-base font-semibold text-emerald-900">Событие опубликовано</h2>
                <p className="mt-0.5 text-sm text-emerald-800/90">Публикация завершена успешно</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
          <h3 className="text-sm font-semibold text-stone-900">Что будет создано</h3>
          <div className="mt-3 space-y-2 text-sm text-stone-700">
            <p>
              <span className="font-medium text-stone-900">Тип:</span> Событие
            </p>
            <p>
              <span className="font-medium text-stone-900">Действие:</span>{" "}
              {decisionLabel[decision] ?? "Создать новый Activity"}
            </p>
            <p>
              <span className="font-medium text-stone-900">Площадка:</span>{" "}
              {venueName ? `«${venueName}»` : "Будет выбрана автоматически"}
            </p>
          </div>
          {shouldShowPlaceHint && (
            <p className="mt-3 text-xs text-stone-500">
              Площадка будет найдена или создана автоматически
            </p>
          )}
        </div>

        {uiState === "ready_to_create" && (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={handleApply}
                disabled={loading}
                className="w-full rounded-xl px-5 py-3.5 text-sm font-semibold text-white bg-[#EF8759] hover:bg-[#e97b49] disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:w-auto"
              >
                {loading ? "Добавляем…" : "Добавить в каталог"}
              </button>
              <DeleteImportedRecordButton
                importedRecordId={importedRecordId}
                isApplied={false}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm text-red-700 transition hover:bg-red-50 w-full sm:w-auto"
              />
            </div>
            <p className="text-xs text-stone-500">Событие будет отправлено на модерацию</p>
          </div>
        )}

        {uiState !== "ready_to_create" && result?.success && (
          <div className="space-y-3">
            {result.activityId && (
              <div className="text-xs text-stone-500">
                Activity ID: <span className="font-mono text-stone-700">{result.activityId}</span>
              </div>
            )}
            {uiState === "created" && result.activityId && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => void handleModeration("APPROVE")}
                  disabled={moderationLoading !== null}
                  className="w-full rounded-xl px-5 py-3.5 text-sm font-semibold text-white bg-[#EF8759] hover:bg-[#e97b49] disabled:opacity-50 disabled:cursor-not-allowed transition-colors sm:w-auto inline-flex items-center justify-center gap-2"
                >
                  {moderationLoading === "APPROVE" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Опубликовать
                </button>
                <Link
                  href={`/editor/event/${result.activityId}/edit?${new URLSearchParams({
                    returnTo: "/admin/import/review",
                    importedRecordId,
                  }).toString()}`}
                  prefetch
                  className="inline-flex items-center justify-center rounded-xl border border-stone-300 px-4 py-3 text-sm text-stone-700 transition hover:bg-stone-50 w-full sm:w-auto"
                >
                  Открыть карточку
                </Link>
                <button
                  type="button"
                  onClick={() => void handleModeration("REJECT")}
                  disabled={moderationLoading !== null}
                  className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-3 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  {moderationLoading === "REJECT" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Отклонить
                </button>
              </div>
            )}
            <p className="text-xs text-stone-500">
              После добавления событие попадёт на модерацию/в каталог согласно текущему workflow
            </p>
          </div>
        )}

        {result && !result.success && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span className="font-medium">Ошибка:</span> {result.error}
          </div>
        )}

        <p className="text-xs text-stone-500">
          Некоторые параметры определены автоматически
        </p>
      </div>
    </div>
  );
}
