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

export function UnsavedPublicationChangesDialog({
  open,
  onOpenChange,
  onConfirmLeave,
  publicationName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmLeave: () => void;
  publicationName: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[92dvh] max-w-[calc(100%-1rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        <AlertDialogHeader>
          <AlertDialogTitle>Несохранённые изменения</AlertDialogTitle>
          <AlertDialogDescription>
            Вы изменили {publicationName}. Уйти без сохранения? Несохранённые правки будут потеряны.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 [&_button]:min-h-11 sm:gap-0 sm:[&_button]:min-h-9">
          <AlertDialogCancel type="button">Остаться</AlertDialogCancel>
          <AlertDialogAction type="button" onClick={onConfirmLeave}>
            Уйти без сохранения
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
