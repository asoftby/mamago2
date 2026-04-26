"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
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
import { deleteImportedRecordAction } from "../../../actions";

interface Props {
  importedRecordId: string;
  isApplied: boolean;
}

type DeleteImportedRecordButtonProps = {
  importedRecordId: string;
  isApplied: boolean;
  className?: string;
};

export function DeleteImportedRecordButton({
  importedRecordId,
  isApplied,
  className,
}: DeleteImportedRecordButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isApplied) return null;

  async function handleDelete() {
    setLoading(true);
    const res = await deleteImportedRecordAction(importedRecordId);
    setLoading(false);
    if (res.success) {
      toast.success("Запись удалена");
      router.push("/admin/import/review");
    } else {
      toast.error(res.error ?? "Ошибка удаления");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-50"
        }
      >
        <Trash2 className="h-4 w-4" />
        Удалить импортированный объект
      </button>

      <AlertDialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить импортированный объект?</AlertDialogTitle>
            <AlertDialogDescription>
              Будут удалены сырой импортированный объект и связанная задача на разбор. Итоговые сущности каталога это не затронет.
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

export function ReviewDetailActions({ importedRecordId, isApplied }: Props) {
  return <DeleteImportedRecordButton importedRecordId={importedRecordId} isApplied={isApplied} />;
}
