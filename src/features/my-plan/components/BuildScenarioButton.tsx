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
        className="h-[54px] w-full rounded-2xl bg-[var(--mp-tx)] text-base font-bold hover:bg-[var(--mp-tx)]/90"
      >
        {label}
      </Button>
      {hint ? <p className="text-center text-[13px] text-[var(--mp-tx2)]">{hint}</p> : null}
    </div>
  );
}
