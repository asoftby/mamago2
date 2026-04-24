"use client";

import { Button } from "@/components/ui/button";

type ScenarioActionBarProps = {
  mode?: "owner" | "viewer";
  onShare: () => void;
  onApply?: () => void;
};

export function ScenarioActionBar({
  mode = "owner",
  onShare,
  onApply,
}: ScenarioActionBarProps) {
  if (mode === "viewer") {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          onClick={() => onApply?.()}
          className="h-12 w-full rounded-2xl bg-neutral-900 text-base font-semibold hover:bg-neutral-800"
        >
          Сохранить в мой план
        </Button>
        <p className="text-center text-xs text-neutral-500">
          Добавим этот сценарий в ваш собственный день
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={onShare}
        className="h-12 w-full rounded-2xl bg-neutral-900 text-base font-semibold hover:bg-neutral-800"
      >
        Поделиться
      </Button>
      <p className="text-center text-xs text-neutral-500">
        Отправьте сценарий дня семье или друзьям по ссылке
      </p>
    </div>
  );
}
