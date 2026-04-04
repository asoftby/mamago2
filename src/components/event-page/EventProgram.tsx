"use client";

import { cn } from "@/lib/utils";

interface ProgramStep {
  id: string;
  title: string;
  description?: string;
  duration?: string;
}

interface EventProgramProps {
  steps: ProgramStep[];
}

/**
 * Блок "Как проходит" - программа события в виде таймлайна.
 * Снижает тревожность пользователя, показывая структуру.
 */
export function EventProgram({ steps }: EventProgramProps) {
  if (steps.length === 0) return null;

  return (
    <section className="border-t border-border/40 py-10">
      <h2 className="mb-8 font-headline text-2xl font-bold text-foreground">
        Как проходит
      </h2>
      <div className="space-y-6">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <div
              key={step.id}
              className={cn(
                "relative flex gap-4 pl-8",
                !isLast &&
                  "before:absolute before:left-[7px] before:top-6 before:h-full before:w-[2px] before:bg-border/40"
              )}
            >
              {/* Номер шага */}
              <div className="absolute left-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {idx + 1}
              </div>

              {/* Содержимое */}
              <div className="flex-1 pb-2">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-[15px] font-semibold text-foreground">
                    {step.title}
                  </h3>
                  {step.duration && (
                    <span className="shrink-0 text-[13px] text-muted-foreground">
                      {step.duration}
                    </span>
                  )}
                </div>
                {step.description && (
                  <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
