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
import { Trash2 } from "lucide-react";
import { claimReviewTaskAction, deleteImportedRecordAction } from "../../actions";

interface Props {
  importedRecordId: string;
  taskId?: string;
  taskStatus?: string;
  isApplied: boolean;
}

export function ReviewQueueActions({ importedRecordId, taskId, taskStatus, isApplied }: Props) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const canClaim = !!taskId && taskStatus === "PENDING";

  async function handleClaim() {
    if (!taskId) return;
    setClaimLoading(true);
    const res = await claimReviewTaskAction(taskId);
    setClaimLoading(false);
    if (res.success) {
      toast.success("Объект отмечен как взятый в работу");
      router.refresh();
    } else {
      toast.error(res.error ?? "Ошибка");
    }
  }

  async function handleDelete() {
    setLoading(true);
    const res = await deleteImportedRecordAction(importedRecordId);
    setLoading(false);
    if (res.success) {
      toast.success("Запись удалена");
      setDeleteOpen(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Ошибка удаления");
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        {canClaim && (
          <button
            onClick={handleClaim}
            disabled={claimLoading}
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
          >
            {claimLoading ? "Берём…" : "В работу"}
          </button>
        )}

        {!isApplied && (
          <button
            onClick={() => setDeleteOpen(true)}
            disabled={loading}
            className="rounded-lg border border-rose-200 p-2 text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
            title="Удалить импортированный объект"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить импортированный объект?</AlertDialogTitle>
            <AlertDialogDescription>
              Будут удалены и сырой импортированный объект, и связанная задача на разбор. Итоговые сущности каталога это не затронет.
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
    </>
  );
}
