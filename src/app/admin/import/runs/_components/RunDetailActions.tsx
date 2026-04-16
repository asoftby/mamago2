"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { deleteImportRunAction, archiveImportRunAction } from "../../actions";

type Props = {
  runId: string;
  sourceName: string;
  appliedCount: number;
  isArchived: boolean;
};

type Modal = "delete" | "archive" | null;

export function RunDetailActions({ runId, sourceName, appliedCount, isArchived }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [loading, setLoading] = useState(false);

  const canDelete = appliedCount === 0 && !isArchived;
  const canArchive = !isArchived;

  if (!canDelete && !canArchive) return null;

  async function handleDelete() {
    setLoading(true);
    const res = await deleteImportRunAction(runId);
    setLoading(false);
    if (res.success) {
      toast.success("Запуск удалён");
      setModal(null);
      router.push("/admin/import/runs");
    } else {
      toast.error(res.error ?? "Ошибка удаления");
    }
  }

  async function handleArchive() {
    setLoading(true);
    const res = await archiveImportRunAction(runId);
    setLoading(false);
    if (res.success) {
      toast.success("Запуск архивирован");
      setModal(null);
      router.refresh();
    } else {
      toast.error(res.error ?? "Ошибка архивирования");
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {canDelete && (
          <button
            onClick={() => setModal("delete")}
            className="rounded px-3 py-1.5 text-sm text-red-600 border border-red-200 hover:bg-red-50 transition"
          >
            Удалить запуск
          </button>
        )}
        {canArchive && appliedCount > 0 && (
          <button
            onClick={() => setModal("archive")}
            className="rounded px-3 py-1.5 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
          >
            Архивировать
          </button>
        )}
      </div>

      <AlertDialog open={modal === "delete"} onOpenChange={(o) => !o && setModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запуск импорта?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Источник: <span className="font-medium text-gray-900">{sourceName}</span></p>
                <p>Будут удалены:</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-500">
                  <li>история запуска</li>
                  <li>импортированные записи</li>
                  <li>задачи на ревью</li>
                </ul>
                <p className="font-medium text-red-600">Это действие нельзя отменить.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Удаление…" : "Удалить"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={modal === "archive"} onOpenChange={(o) => !o && setModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать запуск?</AlertDialogTitle>
            <AlertDialogDescription>
              Запуск будет скрыт из списка, но сохранён для истории.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
            <Button variant="outline" onClick={handleArchive} disabled={loading}>
              {loading ? "Архивирование…" : "Архивировать"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
