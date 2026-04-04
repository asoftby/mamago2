"use client";

import { useMemo } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

export type ConfirmDestructiveActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  entityName?: string;
  requireTyping?: boolean;
  typingValue?: string;
  onTypingValueChange?: (v: string) => void;
  loading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

export function ConfirmDestructiveActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Удалить",
  cancelText = "Отмена",
  entityName,
  requireTyping = false,
  typingValue,
  onTypingValueChange,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDestructiveActionDialogProps) {
  const typingHint = useMemo(() => {
    if (!requireTyping || !entityName) return null;
    return `Введите «${entityName}» для подтверждения`;
  }, [requireTyping, entityName]);

  const canConfirm =
    !loading &&
    (!requireTyping ||
      (typeof entityName === "string" &&
        typeof typingValue === "string" &&
        typingValue.trim() === entityName.trim()));

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>

        {requireTyping ? (
          <div className="grid gap-2">
            {typingHint ? (
              <p className="text-xs text-muted-foreground">{typingHint}</p>
            ) : null}
            <Input
              value={typingValue ?? ""}
              onChange={(e) => onTypingValueChange?.(e.target.value)}
              placeholder={entityName ? entityName : "Название"}
              aria-label="Подтверждение удаление вводом"
              disabled={loading}
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={loading}
            onClick={() => onCancel?.()}
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Удаление..." : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

