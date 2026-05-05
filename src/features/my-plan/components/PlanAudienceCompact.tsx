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
  /** Режим аудитории: "specific" (выбраны персоны) или "free" (для всех) */
  audienceMode: "specific" | "free";
  /** Обработчик переключения персоны */
  onTogglePersona: (personaId: string) => void;
  /** Обработчик переключения в режим "Для всех" */
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
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-neutral-900">Кто идет?</p>
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
                "inline-flex items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200",
                isActive
                  ? "border-[#ffb38a] bg-[linear-gradient(180deg,_#ffb185_0%,_#ff8f61_100%)] text-white shadow-[0_8px_16px_rgba(255,146,93,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(255,146,93,0.35),inset_0_1px_0_rgba(255,255,255,0.5)]"
                  : "border-neutral-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9f9f9_100%)] text-neutral-700 shadow-[0_4px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5 hover:shadow-[0_6px_12px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,1)]",
              )}
            >
              {label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={onToggleFreeMode}
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200",
            isFreeMode
              ? "border-[#ffb38a] bg-[linear-gradient(180deg,_#ffb185_0%,_#ff8f61_100%)] text-white shadow-[0_8px_16px_rgba(255,146,93,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(255,146,93,0.35),inset_0_1px_0_rgba(255,255,255,0.5)]"
              : "border-neutral-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9f9f9_100%)] text-neutral-700 shadow-[0_4px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5 hover:shadow-[0_6px_12px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,1)]",
          )}
        >
          Для всех
        </button>

        <button
          type="button"
          onClick={onAddClick}
          className={cn(
            "ml-auto inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200",
            "border-neutral-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9f9f9_100%)] text-neutral-700",
            "shadow-[0_4px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]",
            "hover:-translate-y-0.5 hover:shadow-[0_6px_12px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,1)]",
          )}
          aria-label="Добавить ребёнка или взрослого"
        >
          <Plus className="h-4 w-4" />
          <span>Добавить</span>
        </button>
      </div>
    </div>
  );
}
