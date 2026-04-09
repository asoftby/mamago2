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
    const list = personas.filter((p) => {
      if (p.kind === "child") return true;
      if (p.kind === "adult") {
        return p.isProfileComplete === true;
      }
      return false;
    });
    return [...list].sort((a, b) => {
      if (a.kind === b.kind) return 0;
      return a.kind === "child" ? -1 : 1;
    });
  }, [personas]);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-neutral-500">Для кого</p>

      <div className="flex flex-wrap items-center gap-2">
        {visiblePersonas.map((persona) => {
          const isSelected = selectedPersonaIds.includes(persona.id);
          const isActive = !isFreeMode && isSelected;

          return (
            <button
              key={`persona-${persona.id}`}
              type="button"
              onClick={() => onTogglePersona(persona.id)}
              className={cn(
                "inline-flex items-center rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50",
              )}
            >
              {persona.displayName}
            </button>
          );
        })}

        <button
          type="button"
          onClick={onAddClick}
          className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          aria-label="Добавить ребёнка или взрослого"
        >
          <Plus className="h-4 w-4" />
        </button>

        <span className="mx-0.5 h-5 w-px shrink-0 bg-neutral-200" aria-hidden />

        <button
          type="button"
          onClick={onToggleFreeMode}
          className={cn(
            "inline-flex h-[34px] shrink-0 items-center rounded-full border px-3 text-sm font-medium transition-colors",
            isFreeMode
              ? "border-neutral-900 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
              : "border-dashed border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50",
          )}
        >
          Свободный поиск
        </button>
        <span
          className={cn(
            "text-xs text-neutral-400",
            !isFreeMode && "invisible select-none",
          )}
          aria-hidden={!isFreeMode}
        >
          без выбора участников
        </span>
      </div>

      <div className="min-h-[2.25rem]">
        <p
          className={cn(
            "text-xs leading-relaxed text-neutral-400",
            !isFreeMode && "invisible",
          )}
          aria-hidden={!isFreeMode}
        >
          Показываем популярные и универсальные варианты без персонализации по профилям.
        </p>
      </div>
    </div>
  );
}
