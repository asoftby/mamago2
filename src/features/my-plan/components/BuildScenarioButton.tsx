"use client";

import { Button } from "@/components/ui/button";

type BuildScenarioButtonProps = {
  onClick: () => void;
};

export function BuildScenarioButton({ onClick }: BuildScenarioButtonProps) {
  return (
    <div className="space-y-2">
      <Button
        onClick={onClick}
        className="h-12 w-full rounded-2xl bg-neutral-900 text-base font-semibold hover:bg-neutral-800"
      >
        Собрать сценарий дня
      </Button>
      <p className="text-center text-xs text-neutral-500">
        Соберем из добавленных событий красивый маршрут дня
      </p>
    </div>
  );
}
