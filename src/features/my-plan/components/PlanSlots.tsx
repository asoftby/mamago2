"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Cloud, Moon, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Slot {
  id: string;
  period: "morning" | "afternoon" | "evening";
  label: string;
  emoji: React.ReactNode;
  activityName: string;
  state: "suggested" | "selected";
}

const initialSlots: Slot[] = [
  {
    id: "morning",
    period: "morning",
    label: "Утро",
    emoji: <Sun className="h-5 w-5 text-amber-500" />,
    activityName: "Мастер-класс по керамике",
    state: "suggested",
  },
  {
    id: "afternoon",
    period: "afternoon",
    label: "День",
    emoji: <Cloud className="h-5 w-5 text-blue-400" />,
    activityName: "Детский спектакль «Лиса и медведь»",
    state: "suggested",
  },
  {
    id: "evening",
    period: "evening",
    label: "Вечер",
    emoji: <Moon className="h-5 w-5 text-indigo-500" />,
    activityName: "Творческая мастерская",
    state: "suggested",
  },
];

interface PlanSlotsProps {
  onComplete?: () => void;
}

export function PlanSlots({ onComplete }: PlanSlotsProps) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots);

  const handleToggleSlot = (slotId: string) => {
    setSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              state: slot.state === "suggested" ? "selected" : "suggested",
            }
          : slot
      )
    );
  };

  const selectedCount = slots.filter((s) => s.state === "selected").length;

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">
            Ваш план на сегодня
          </h1>
          <p className="text-base text-gray-600">
            Выберите активности, которые хотите добавить в план
          </p>
        </div>

        {/* Slots */}
        <div className="space-y-4">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className={cn(
                "p-4 rounded-xl border-2 transition-all cursor-pointer",
                slot.state === "selected"
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
              onClick={() => handleToggleSlot(slot.id)}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">{slot.emoji}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 font-medium mb-1">
                    {slot.label}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 line-clamp-2">
                    {slot.activityName}
                  </div>
                </div>

                {/* Action button */}
                <Button
                  variant={slot.state === "selected" ? "default" : "outline"}
                  size="sm"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSlot(slot.id);
                  }}
                >
                  {slot.state === "selected" ? (
                    <>
                      <Check className="h-4 w-4 mr-1.5" />
                      В плане
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Добавить в план
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white space-y-3">
        <Button
          onClick={onComplete}
          disabled={selectedCount === 0}
          className="w-full h-12 text-base font-semibold bg-gray-900 hover:bg-gray-800"
        >
          {selectedCount > 0
            ? `Показать мой план (${selectedCount})`
            : "Выберите активности"}
        </Button>
        <p className="text-xs text-gray-500 text-center">
          Вы сможете менять план в любой момент
        </p>
      </div>
    </div>
  );
}
