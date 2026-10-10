"use client";

import { X } from "lucide-react";
import { ResponsiveOverlay } from "@/components/ui/responsive-overlay";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import {
  PlanNewTaskScreen,
  type PlanNewTaskPerson,
} from "@/features/my-plan/components/v3/PlanNewTaskScreen";
import { MY_PLAN_V3_TOKENS } from "@/features/my-plan/components/v3/myPlanV3Tokens";
import { todayKey } from "@/lib/date/dateKey";

/**
 * Full-page "My Plan" uses the exact same new-task form as the widget.
 * Editing an existing manual record stays in ManualPlanEntryDialog.
 */
export function PlanNewTaskDialog({
  open,
  onOpenChange,
  date,
  familyChildren,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  familyChildren: Array<{ id: string; name: string }>;
  onSaved: (date: string) => void;
}) {
  const family = useFamilyPersona();
  const people: PlanNewTaskPerson[] = (family?.personas ?? []).map((person) => ({
    id: person.id,
    name: person.displayName?.trim() || (person.kind === "adult" ? "Я" : ""),
    kind: person.kind,
  }));
  // During profile loading, known children remain selectable.
  for (const child of familyChildren) {
    if (!people.some((person) => person.id === child.id)) {
      people.push({ id: child.id, name: child.name, kind: "child" });
    }
  }

  const today = todayKey();

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Добавить в план"
      variant="chromeless"
      showCloseButton={false}
      heightMode="tall"
      dialogContentClassName="!w-[min(92vw,620px)] !max-w-[620px] !h-[min(90vh,760px)]"
      bodyClassName="min-h-0 overflow-hidden"
    >
      <div
        style={MY_PLAN_V3_TOKENS}
        className="relative flex min-h-0 flex-1 flex-col bg-[var(--mp-bg)] text-[var(--mp-tx)]"
      >
        <button
          type="button"
          aria-label="Закрыть форму"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full text-[var(--mp-tx2)] transition-colors hover:bg-[var(--mp-soft)]"
        >
          <X className="h-5 w-5" />
        </button>
        {open && (
          <PlanNewTaskScreen
            todayIso={today}
            initialDate={date < today ? today : date}
            people={people}
            onBack={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </div>
    </ResponsiveOverlay>
  );
}
