"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type DeletionSummary = {
  runsCount: number;
  importedRecordsCount: number;
  reviewTasksCount: number;
  hasDependencies: boolean;
};

interface Props {
  sourceId: string;
  sourceName: string;
}

export function DeleteSourcePermanentlyButton({ sourceId, sourceName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [summary, setSummary] = useState<DeletionSummary | null>(null);

  async function loadSummaryAndOpen() {
    setLoadingSummary(true);

    try {
      const response = await fetch(`/admin/import/sources/${sourceId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });

      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        summary?: DeletionSummary;
      };

      if (!result.success || !result.summary) {
        toast.error(result.error ?? "Не удалось подготовить удаление");
        return;
      }

      setSummary(result.summary);
      setOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось подготовить удаление");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);

    try {
      const response = await fetch(`/admin/import/sources/${sourceId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });

      const result = (await response.json()) as { success: boolean; error?: string };

      if (!result.success) {
        toast.error(result.error ?? "Не удалось удалить источник");
        return;
      }

      toast.success("Источник удалён");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить источник");
    } finally {
      setDeleting(false);
    }
  }

  const hasDependencies = summary?.hasDependencies ?? false;

  return (
    <>
      <button
        onClick={loadSummaryAndOpen}
        disabled={loadingSummary}
        className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {loadingSummary ? "Проверяем…" : "Удалить навсегда"}
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить источник навсегда?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  Источник <span className="font-medium text-gray-900">«{sourceName}»</span> будет удалён из базы данных без возможности восстановления.
                </p>

                {hasDependencies ? (
                  <>
                    <p>Этот источник уже использовался.</p>
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                      <div>Будет удалено:</div>
                      <ul className="mt-2 space-y-1">
                        <li>• {summary?.runsCount ?? 0} прогонов</li>
                        <li>• {summary?.importedRecordsCount ?? 0} импортированных объектов</li>
                        <li>• {summary?.reviewTasksCount ?? 0} задач ревью</li>
                      </ul>
                    </div>
                    <p className="font-medium text-rose-700">Это действие необратимо.</p>
                  </>
                ) : (
                  <p>У источника нет прогонов и импортированных объектов. Будет удалена только сама запись источника.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Удаляем…" : "Удалить всё навсегда"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
