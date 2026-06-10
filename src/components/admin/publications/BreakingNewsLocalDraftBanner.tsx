"use client";

import { Button } from "@/components/ui/button";

export function BreakingNewsLocalDraftBanner({
  onRestore,
  onDiscard,
  disabled = false,
}: {
  onRestore: () => void;
  onDiscard: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-md border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 sm:flex-row sm:items-center sm:justify-between"
    >
      <p>У вас есть несохранённый черновик Breaking News.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={onRestore} disabled={disabled}>
          Восстановить
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onDiscard}
          disabled={disabled}
        >
          Удалить
        </Button>
      </div>
    </div>
  );
}
