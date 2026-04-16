"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  ImportEntityType,
  ImportMatchStatus,
  ImportReviewStatus,
  ImportReviewTaskStatus,
  ImportSuggestedAction,
} from "@prisma/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";
import { ReviewQueueActions } from "./ReviewQueueActions";
import {
  formatImportEntity,
  getImportedObjectStage,
  importEntityBadgeClasses,
  suggestedActionClasses,
  suggestedActionLabels,
  taskStatusClasses,
  taskStatusLabels,
} from "../../_lib/import-admin-ui";

type ReviewQueueRow = {
  id: string;
  createdAtLabel: string;
  importedRecord: {
    id: string;
    sourceUrl: string | null;
    entityTypeHint: ImportEntityType | null;
    qualityScore: number | null;
    confidenceScore: number | null;
    matchStatus: ImportMatchStatus | null;
    normalizedTitle: string | null;
    publishedPlaceId: string | null;
    publishedActivityId: string | null;
    reviewStatus: ImportReviewStatus;
    source: {
      id: string;
      name: string;
      slug: string;
    };
  };
  reviewTask: {
    id: string;
    status: ImportReviewTaskStatus;
    suggestedAction: ImportSuggestedAction | null;
  } | null;
};

interface Props {
  records: ReviewQueueRow[];
}

export function ReviewQueueTableClient({ records }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPending, startBulkTransition] = useTransition();

  const deletableIds = useMemo(
    () =>
      records
        .filter((row) => !row.importedRecord.publishedPlaceId && !row.importedRecord.publishedActivityId)
        .map((row) => row.importedRecord.id),
    [records],
  );

  const allSelected = deletableIds.length > 0 && deletableIds.every((id) => selectedIds.includes(id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  function toggleRow(importedRecordId: string, nextChecked: boolean) {
    setSelectedIds((prev) =>
      nextChecked ? [...new Set([...prev, importedRecordId])] : prev.filter((id) => id !== importedRecordId),
    );
  }

  function toggleAll(nextChecked: boolean) {
    setSelectedIds(nextChecked ? deletableIds : []);
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(
      `Удалить ${selectedIds.length} импортированных объектов?\n\nБудут удалены сырой импорт и связанные задачи на разбор. Это действие нельзя отменить.`,
    );

    if (!confirmed) return;

    startBulkTransition(async () => {
      try {
        const response = await fetch("/admin/import/actions/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importedRecordIds: selectedIds }),
        });

        const result = (await response.json()) as { success: boolean; count?: number; error?: string };

        if (!result.success) {
          toast.error(result.error ?? "Не удалось удалить выбранные объекты");
          return;
        }

        toast.success(`Удалено: ${result.count ?? selectedIds.length}`);
        setSelectedIds([]);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Не удалось выполнить массовое удаление");
      }
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="w-12 px-4 py-3 text-left">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Выбрать все удаляемые объекты"
                  disabled={deletableIds.length === 0}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Импортированный объект</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Стадия</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Источник</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Качество</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Итоговая сущность</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map((row) => {
              const rec = row.importedRecord;
              const task = row.reviewTask;
              const linkedEntityId = rec.publishedPlaceId ?? rec.publishedActivityId;
              const stage = getImportedObjectStage({
                taskStatus: task?.status,
                reviewStatus: rec.reviewStatus,
                publishedPlaceId: rec.publishedPlaceId,
                publishedActivityId: rec.publishedActivityId,
                hasReviewTask: Boolean(task),
              });
              const canDelete = !linkedEntityId;

              return (
                <tr key={rec.id} className={task?.status === "IN_PROGRESS" ? "bg-blue-50/40" : "hover:bg-gray-50"}>
                  <td className="px-4 py-4 align-top">
                    <Checkbox
                      checked={selectedIds.includes(rec.id)}
                      onCheckedChange={(checked) => toggleRow(rec.id, checked === true)}
                      aria-label={`Выбрать объект ${rec.normalizedTitle ?? rec.id}`}
                      disabled={!canDelete}
                    />
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="max-w-[21rem]">
                      <div className="flex flex-wrap items-center gap-2">
                        {rec.entityTypeHint && (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${importEntityBadgeClasses[rec.entityTypeHint]}`}>
                            {formatImportEntity(rec.entityTypeHint)}
                          </span>
                        )}
                        <span className="font-medium text-gray-900">
                          {rec.normalizedTitle ?? <span className="italic text-gray-400">Без названия</span>}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {task && (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${taskStatusClasses[task.status]}`}>
                            {taskStatusLabels[task.status]}
                          </span>
                        )}
                        {task?.suggestedAction && (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${suggestedActionClasses[task.suggestedAction]}`}>
                            {suggestedActionLabels[task.suggestedAction]}
                          </span>
                        )}
                        {!task && (
                          <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-900">
                            Нет задачи ревью (ошибка)
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">Добавлен {row.createdAtLabel}</div>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${stage.tone}`}>
                      {stage.label}
                    </span>
                    <p className="mt-2 max-w-xs text-xs leading-5 text-gray-600">{stage.helper}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-xs text-gray-600">
                    <div className="font-medium text-gray-800">{rec.source.name}</div>
                    <div className="mt-1 font-mono text-gray-500">{rec.source.slug}</div>
                    {rec.sourceUrl && (
                      <a href={rec.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block max-w-[16rem] truncate text-blue-600 hover:underline">
                        Открыть исходную страницу
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top text-xs text-gray-600">
                    <div>Качество: {rec.qualityScore != null ? `${Math.round(rec.qualityScore * 100)}%` : "—"}</div>
                    <div className="mt-1">Уверенность: {rec.confidenceScore != null ? `${Math.round(rec.confidenceScore * 100)}%` : "—"}</div>
                    <div className="mt-1">Match: {rec.matchStatus ?? "—"}</div>
                  </td>
                  <td className="px-4 py-4 align-top text-xs text-gray-600">
                    {rec.publishedPlaceId ? (
                      <Link href={`/admin/content/places/${rec.publishedPlaceId}`} className="font-medium text-emerald-700 hover:underline">
                        Place #{rec.publishedPlaceId}
                      </Link>
                    ) : rec.publishedActivityId ? (
                      <span className="font-medium text-emerald-700">Event #{rec.publishedActivityId}</span>
                    ) : rec.reviewStatus === "APPROVED" ? (
                      <span className="text-emerald-700">Ещё не создана</span>
                    ) : (
                      <span className="text-gray-500">Пока нет</span>
                    )}
                    <p className="mt-2 max-w-xs text-xs leading-5 text-gray-500">
                      {canDelete
                        ? "Можно удалить, если сырой импорт больше не нужен."
                        : "Удаление отключено: объект уже связан с сущностью каталога."}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/import/review/${rec.id}`}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-700"
                      >
                        Открыть
                      </Link>
                      <ReviewQueueActions
                        importedRecordId={rec.id}
                        taskId={task?.id}
                        taskStatus={task?.status}
                        isApplied={!canDelete}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 flex w-[min(92vw,760px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-xl">
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-900">Выбрано объектов: {selectedIds.length}</div>
            <div className="text-xs text-gray-500">Массовое удаление работает только для сырого импорта, который ещё не связан с Place/Event.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSelectedIds([])} disabled={bulkPending}>
              <X className="mr-1.5 h-4 w-4" />
              Снять выбор
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkPending}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              {bulkPending ? "Удаляем…" : "Удалить выбранное"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
