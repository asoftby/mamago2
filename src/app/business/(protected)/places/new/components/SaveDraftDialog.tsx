"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface SaveDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveDraft: () => void;
  onDiscard: () => void;
  isSaving: boolean;
}

export function SaveDraftDialog({
  open,
  onOpenChange,
  onSaveDraft,
  onDiscard,
  isSaving,
}: SaveDraftDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Сохранить черновик?</AlertDialogTitle>
          <AlertDialogDescription>
            Вы уже заполнили часть информации. Сохранить место в черновик, чтобы продолжить позже?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard} disabled={isSaving}>
            Закрыть без сохранения
          </AlertDialogCancel>
          <AlertDialogAction onClick={onSaveDraft} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              "Сохранить в черновик"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
