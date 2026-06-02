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

type AudienceExplanationMode = "free" | "adult" | "child" | "family";

const audienceModeMeta: Record<
  AudienceExplanationMode,
  { title: string; description: string }
> = {
  free: {
    title: "Свободный поиск",
    description:
      "Ищите без ограничений — покажем все интересные варианты, а вы выберете то, что подходит именно сейчас.",
  },
  adult: {
    title: "Подбор для вас",
    description:
      "Учитываем ваши интересы и предпочтения. В приоритете — события, которые могут быть интересны именно вам.",
  },
  child: {
    title: "Подбор для ребёнка",
    description:
      "Сначала показываем события, которые лучше всего подходят ребёнку — по возрасту, интересам и формату.",
  },
  family: {
    title: "Семейный подбор",
    description:
      "В приоритете — интересы ребёнка, но мы также учитываем ваши предпочтения, чтобы подобрать комфортный вариант для всей семьи.",
  },
};

function PlanAudienceModeHint({
  mode,
  compact = false,
}: {
  mode: AudienceExplanationMode;
  compact?: boolean;
}) {
  const meta = audienceModeMeta[mode];

  return (
    <div className="relative z-0 pointer-events-none rounded-[16px] border border-[rgba(20,18,16,0.08)] bg-[rgba(255,255,255,0.55)] px-3.5 py-3">
      <div className="space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[rgba(20,18,16,0.45)]">
          Режим подбора
        </p>
        <p
          className={cn(
            "text-[#141210]",
            compact ? "text-[15px] leading-[1.15]" : "text-[16px] leading-[1.15]",
          )}
          style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}
        >
          {meta.title}
        </p>
        <p
          className={cn(
            "text-[rgba(20,18,16,0.58)]",
            compact ? "text-[12px] leading-[1.45]" : "text-[13px] leading-[1.45]",
          )}
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {meta.description}
        </p>
      </div>
    </div>
  );
}

export function PlanAudienceCompact({
  selectedPersonaIds,
  personas,
  audienceMode,
  onTogglePersona,
  onToggleFreeMode,
  onAddClick,
  compact = false,
}: PlanAudienceCompactProps) {
  const isFreeMode = audienceMode === "free";

  const visiblePersonas = useMemo(() => {
    const list = personas.filter((p) => p.kind === "child" || p.kind === "adult");
    return [...list].sort((a, b) => {
      if (a.kind === b.kind) return 0;
      return a.kind === "adult" ? -1 : 1;
    });
  }, [personas]);

  const audienceExplanationMode = useMemo<AudienceExplanationMode>(() => {
    if (isFreeMode || selectedPersonaIds.length === 0) return "free";

    const selectedPersonas = visiblePersonas.filter((persona) =>
      selectedPersonaIds.includes(persona.id),
    );

    const hasAdult = selectedPersonas.some((persona) => persona.kind === "adult");
    const hasChild = selectedPersonas.some((persona) => persona.kind === "child");

    if (hasAdult && hasChild) return "family";
    if (hasChild) return "child";
    if (hasAdult) return "adult";
    return "free";
  }, [isFreeMode, selectedPersonaIds, visiblePersonas]);

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-[#FAF7F1] p-4">
      <div className="space-y-1">
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 400, lineHeight: 1.1, color: "#141210" }}>Кто идет?</p>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-2">
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
                "relative z-10 inline-flex min-h-11 items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200",
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
            "relative z-10 inline-flex min-h-11 shrink-0 items-center rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200",
            isFreeMode
              ? "border-[#ffb38a] bg-[linear-gradient(180deg,_#ffb185_0%,_#ff8f61_100%)] text-white shadow-[0_8px_16px_rgba(255,146,93,0.3),inset_0_1px_0_rgba(255,255,255,0.4)] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(255,146,93,0.35),inset_0_1px_0_rgba(255,255,255,0.5)]"
              : "border-neutral-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f9f9f9_100%)] text-neutral-700 shadow-[0_4px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5 hover:shadow-[0_6px_12px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,1)]",
          )}
        >
          Свободный поиск
        </button>

        <button
          type="button"
          onClick={onAddClick}
          className={cn(
            "relative z-10 ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200",
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

      <PlanAudienceModeHint
        mode={audienceExplanationMode}
        compact={compact}
      />
    </div>
  );
}
