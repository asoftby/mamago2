"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanAudienceCompactProps {
  /** Выбранные персоны */
  selectedPersonaIds: string[];
  /** Все доступные персоны */
  personas: Array<{
    id: string;
    displayName: string;
    kind: "adult" | "child";
    isProfileComplete?: boolean;
  }>;
  /** Режим аудитории: "specific" (выбраны персоны) или "free" (свободный поиск) */
  audienceMode: "specific" | "free";
  /** Обработчик переключения персоны */
  onTogglePersona: (personaId: string) => void;
  /** Обработчик переключения в режим "Свободный поиск" */
  onToggleFreeMode: () => void;
  /** Обработчик клика на кнопку "+" */
  onAddClick: () => void;
  /** Компактный режим (для мобильных) - deprecated, kept for compatibility */
  compact?: boolean;
}

export function PlanAudienceCompact({
  selectedPersonaIds,
  personas,
  audienceMode,
  onTogglePersona,
  onToggleFreeMode,
  onAddClick,
}: PlanAudienceCompactProps) {
  const isFreeMode = audienceMode === "free";

  const visiblePersonas = useMemo(() => {
    const list = personas.filter((p) => p.kind === "child" || p.kind === "adult");
    return [...list].sort((a, b) => {
      if (a.kind === b.kind) return 0;
      return a.kind === "adult" ? -1 : 1;
    });
  }, [personas]);

  return (
    <div className="space-y-3 rounded-[26px] border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-neutral-900">Кто идет?</p>
        <p className="text-sm leading-snug text-neutral-500">
          Выберите участников, чтобы адаптировать идеи под ребенка, взрослого или всю семью.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {visiblePersonas.map((persona) => {
          const isSelected = selectedPersonaIds.includes(persona.id);
          const isActive = !isFreeMode && isSelected;
          const label =
            persona.kind === "adult" ? "Я" : persona.displayName;

          return (
            <button
              key={`persona-${persona.id}`}
              type="button"
              onClick={() => onTogglePersona(persona.id)}
              className={cn(
                "inline-flex items-center rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-[#FDBA9A] bg-[#FFF2EB] text-neutral-950 shadow-sm hover:bg-[#FFE9DD]"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
              )}
            >
              {label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={onAddClick}
          className="inline-flex items-center gap-2 rounded-full border border-dashed border-neutral-300 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
          aria-label="Добавить ребёнка или взрослого"
        >
          <Plus className="h-4 w-4" />
          <span>Добавить</span>
        </button>

        <button
          type="button"
          onClick={onToggleFreeMode}
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
            isFreeMode
              ? "border-neutral-300 bg-neutral-100 text-neutral-900 shadow-sm hover:bg-white"
              : "border-dashed border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50",
          )}
        >
          Свободный поиск
        </button>
      </div>
    </div>
  );
}
