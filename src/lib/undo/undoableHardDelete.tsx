"use client";

import { toast } from "@/lib/toast";
import { UndoCountdownToastContent } from "@/components/ui/undo-countdown-toast";

type Pending = {
  timeoutId: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, Pending>();

export function cancelUndoableHardDelete(key: string) {
  const p = pending.get(key);
  if (!p) return;
  clearTimeout(p.timeoutId);
  pending.delete(key);
}

export function startUndoableHardDelete(args: {
  key: string;
  durationMs?: number;
  toastText: string;
  undoText?: string;
  onOptimisticRemove: () => void;
  onUndoRestore: () => void;
  commitDelete: () => Promise<void>;
  /** После успешного удаления на сервере (после окна Undo). */
  onCommitSuccess?: () => void;
  onCommitError?: (e: unknown) => void;
}) {
  const {
    key,
    durationMs = 8000,
    toastText,
    undoText = "Отменить",
    onOptimisticRemove,
    onUndoRestore,
    commitDelete,
    onCommitSuccess,
    onCommitError,
  } = args;

  cancelUndoableHardDelete(key);

  onOptimisticRemove();

  const timeoutId = setTimeout(async () => {
    pending.delete(key);
    try {
      await commitDelete();
      onCommitSuccess?.();
    } catch (e) {
      onCommitError?.(e);
      toast.error("Не получилось выполнить действие. Обновите страницу и попробуйте снова.");
      onUndoRestore();
    }
  }, durationMs);

  pending.set(key, { timeoutId });

  toast.custom(
    (tid) => (
      <UndoCountdownToastContent
        toastId={tid}
        message={toastText}
        durationMs={durationMs}
        undoLabel={undoText}
        onUndo={() => {
          cancelUndoableHardDelete(key);
          onUndoRestore();
        }}
      />
    ),
    { duration: durationMs },
  );
}
