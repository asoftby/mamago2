"use client";

interface BirthdayQuizProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function BirthdayQuizProgress({ currentStep, totalSteps }: BirthdayQuizProgressProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={[
              "h-1.5 rounded-full transition-all duration-300",
              i < currentStep
                ? "bg-[#EF8759] w-6"
                : i === currentStep - 1
                ? "bg-[#EF8759] w-8"
                : "bg-border w-4",
            ].join(" ")}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        Шаг {currentStep} из {totalSteps}
      </span>
    </div>
  );
}
