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
import { archiveImportSourceAction } from "../../actions";

interface Props {
  sourceId: string;
  sourceName: string;
}

export function ArchiveSourceButton({ sourceId, sourceName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const res = await archiveImportSourceAction(sourceId);
    setLoading(false);
    if (res.success) {
      toast.success("Источник отправлен в архив");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Не удалось архивировать источник");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
      >
        В архив
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перенести источник в архив?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  Источник <span className="font-medium text-gray-900">«{sourceName}»</span> исчезнет из рабочих списков.
                </p>
                <p>Прогоны, импортированные объекты и вся история сохранятся для аудита, поэтому это не безвозвратное удаление.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Отмена</AlertDialogCancel>
            <Button variant="outline" onClick={handleConfirm} disabled={loading}>
              {loading ? "Архивируем…" : "Отправить в архив"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
