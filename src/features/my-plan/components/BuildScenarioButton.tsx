"use client";

import { Button } from "@/components/ui/button";

type BuildScenarioButtonProps = {
  onClick: () => void;
  label: string;
  hint?: string;
};

export function BuildScenarioButton({ onClick, label, hint }: BuildScenarioButtonProps) {
  return (
    <div className="space-y-2">
      <Button
        onClick={onClick}
        className="h-12 w-full rounded-2xl bg-neutral-900 text-base font-semibold hover:bg-neutral-800"
      >
        {label}
      </Button>
      {hint ? <p className="text-center text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}
