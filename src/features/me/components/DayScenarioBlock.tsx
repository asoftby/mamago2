"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, Plus, MapPin, Check, Trash2 } from "lucide-react";
import { BodyMuted } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { buildDayScenario, type ScenarioStep, type SlotResult } from "@/features/me/lib/dayScenario";
import { useAddScenarioPlan } from "@/hooks/useAddScenarioPlan";
import {
  initialSelection,
  getActiveChildIds,
  mergeInterests,
  buildScenarioHeading,
  type ChildSelection,
} from "@/features/me/lib/childContextSwitcher";

interface ChildData {
  id: string;
  name: string;
  birthDate: Date;
  systemInterests?: { interestSlug: string }[];
}

interface Props {
  children: ChildData[];
  selectedDate: string;
}

function getAgeShort(d: Date): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / (30.44 * 24 * 3600 * 1000));
  return m < 12 ? `${m}м` : `${Math.floor(m / 12)}л`;
}

// ── Child switcher ────────────────────────────────────────────────────────────

function ChildSwitcher({ children, selection, onChange }: {
  children: ChildData[];
  selection: ChildSelection;
  onChange: (s: ChildSelection) => void;
}) {
  if (children.length === 1) {
    const c = children[0]!;
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-white">
        {c.name}
        <span className="text-xs text-white/70">{getAgeShort(new Date(c.birthDate))}</span>
      </span>
    );
  }
  return (
    <div className="flex gap-2 flex-wrap">
      <button onClick={() => onChange(null)}
        className={cn("inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
          selection === null ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")}>
        Для всех
      </button>
      {children.map((c) => (
        <button key={c.id} onClick={() => onChange(c.id)}
          className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            selection === c.id ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")}>
          {c.name}
          <span className={cn("text-xs", selection === c.id ? "text-white/70" : "text-neutral-400")}>
            {getAgeShort(new Date(c.birthDate))}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({ step, onReplace, onRemove, isSaved }: {
  step: ScenarioStep;
  onReplace: () => void;
  onRemove: () => void;
  isSaved?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 bg-white border border-neutral-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="relative h-20 w-20 shrink-0">
        <Image src={step.image} alt={step.title} fill className="object-cover" sizes="80px" />
      </div>
      <div className="flex-1 min-w-0 py-2.5 pr-2">
        <p className="text-sm font-semibold text-neutral-900 leading-snug line-clamp-1">{step.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[11px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">{step.type}</span>
          <span className="inline-flex items-center gap-0.5 text-[11px] text-neutral-400">
            <MapPin className="h-3 w-3 shrink-0" />{step.location}
          </span>
        </div>
        <p className="text-[11px] text-neutral-400 mt-1">
          {step.time}{step.price ? ` • ${step.price}` : ""}
        </p>

        {/* Saved: inline action row */}
        {isSaved && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[11px] font-medium text-primary">Добавлено в план</span>
            <button onClick={onReplace}
              className="text-[11px] text-neutral-400 hover:text-neutral-700 transition-colors">
              Ещё варианты
            </button>
            <button onClick={onRemove} aria-label="Удалить"
              className="text-neutral-400 hover:text-neutral-700 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Unsaved: vertical right actions */}
      {!isSaved && (
        <div className="flex flex-col gap-1.5 pr-4 py-3 shrink-0 items-end">
          <div role="button" tabIndex={0} onClick={onReplace} onKeyDown={(e) => e.key === "Enter" && onReplace()}
            className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-700 transition-colors whitespace-nowrap">
            Ещё варианты
          </div>
          <div role="button" tabIndex={0} onClick={onRemove} onKeyDown={(e) => e.key === "Enter" && onRemove()}
            className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
            Убрать
          </div>
        </div>
      )}
    </div>
  );
}

// ── Slot section ──────────────────────────────────────────────────────────────

function SlotSection({ slotResult, primaryStep, secondaryStep, showSecondary, canAddMore,
  onReplacePrimary, onRemovePrimary, onReplaceSecondary, onRemoveSecondary, onAdd, isSaved }: {
  slotResult: SlotResult;
  primaryStep: ScenarioStep | null;
  secondaryStep: ScenarioStep | null;
  showSecondary: boolean;
  canAddMore: boolean;
  onReplacePrimary: () => void;
  onRemovePrimary: () => void;
  onReplaceSecondary: () => void;
  onRemoveSecondary: () => void;
  onAdd: () => void;
  isSaved?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
        {slotResult.slot.label}
      </p>

      {/* Primary */}
      {primaryStep ? (
        <StepCard step={primaryStep} onReplace={onReplacePrimary} onRemove={onRemovePrimary} isSaved={isSaved} />
      ) : (
        <button onClick={onAdd}
          className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-primary/40 hover:text-primary transition-colors text-sm font-medium">
          <Plus className="h-4 w-4" />Добавь ещё
        </button>
      )}

      {/* Secondary */}
      {showSecondary && (
        secondaryStep ? (
          <StepCard step={secondaryStep} onReplace={onReplaceSecondary} onRemove={onRemoveSecondary} isSaved={isSaved} />
        ) : (
          <button onClick={onAdd}
            className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-primary/40 hover:text-primary transition-colors text-sm font-medium">
            <Plus className="h-4 w-4" />Добавь ещё
          </button>
        )
      )}

      {/* Add second — only if primary exists and max not reached */}
      {primaryStep && canAddMore && (
        <button onClick={onAdd}
          className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400 hover:border-primary/40 hover:text-primary transition-colors text-sm font-medium">
          <Plus className="h-4 w-4" />Добавь ещё
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function DayScenarioBlock({ children, selectedDate }: Props) {
  const [selection, setSelection] = useState<ChildSelection>(() => initialSelection(children.length));
  const [globalSeed, setGlobalSeed] = useState(0);
  const [slotState, setSlotState] = useState<Record<string, {
    primary: number | null;
    secondary: number | null;
    showSecondary: boolean;
  }>>({});
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset scenario when date changes
  useEffect(() => {
    queueMicrotask(() => {
      setGlobalSeed(0);
      setSlotState({});
      setDirty(false);
      setSaved(false);
    });
  }, [selectedDate]);

  const { addScenario, confirmConflict, dismissConflict, saveState, conflict } = useAddScenarioPlan();

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaved(false);
  }, []);

  const handleSelectionChange = (s: ChildSelection) => {
    setSelection(s);
    setGlobalSeed(0);
    setSlotState({});
    markDirty();
  };

  // ── No children ──
  if (children.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-neutral-700 mb-1">Добавьте ребёнка и его интересы</p>
        <BodyMuted className="text-xs mb-4">— мы подберём идеи на день</BodyMuted>
        <Link href="/me">
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition-colors">
            <Plus className="w-4 h-4" />Добавить ребёнка
          </button>
        </Link>
      </div>
    );
  }

  const merged = mergeInterests(selection, children);
  const hasInterests = merged.length > 0;
  const activeIds = getActiveChildIds(selection, children.map((c) => c.id));
  const activeChildren = children.filter((c) => activeIds.includes(c.id));

  // ── No interests ──
  if (!hasInterests) {
    return (
      <div className="space-y-3">
        <ChildSwitcher selection={selection} onChange={handleSelectionChange}>{children}</ChildSwitcher>
        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-neutral-700 mb-1">
            Добавьте интересы {activeChildren.map((c) => c.name).join(" и ")}
          </p>
          <BodyMuted className="text-xs mb-4">— мы подберём идеи на день</BodyMuted>
          <Link href="/me">
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition-colors">
              Выбрать интересы
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const youngest = [...activeChildren].sort(
    (a, b) => new Date(b.birthDate).getTime() - new Date(a.birthDate).getTime(),
  )[0]!;

  // Derive a stable numeric seed from the date string so each day gets a different scenario
  const dateSeed = selectedDate.split("-").reduce((acc, part) => acc + parseInt(part, 10), 0);

  const scenario = buildDayScenario(
    { name: "", birthDate: new Date(youngest.birthDate), mergedInterests: merged },
    dateSeed + globalSeed,
  );

  if (!scenario) {
    return (
      <div className="space-y-3">
        <ChildSwitcher selection={selection} onChange={handleSelectionChange}>{children}</ChildSwitcher>
        <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-6 text-center">
          <BodyMuted className="text-sm">Нет подходящих событий на этот день</BodyMuted>
        </div>
      </div>
    );
  }

  const getSlot = (slotId: string) =>
    slotState[slotId] ?? { primary: 0, secondary: null, showSecondary: false };

  const handleReplace = (slotId: string, which: "primary" | "secondary", altsLen: number) => {
    setSlotState((prev) => {
      const cur = getSlot(slotId);
      const curIdx = cur[which] ?? 0;
      return { ...prev, [slotId]: { ...cur, [which]: (curIdx + 1) % altsLen } };
    });
    markDirty();
  };

  const handleRemove = (slotId: string, which: "primary" | "secondary") => {
    setSlotState((prev) => {
      const cur = getSlot(slotId);
      if (which === "secondary") {
        return { ...prev, [slotId]: { ...cur, secondary: null, showSecondary: false } };
      }
      // Removing primary: promote secondary if exists
      if (cur.secondary !== null) {
        return { ...prev, [slotId]: { primary: cur.secondary, secondary: null, showSecondary: false } };
      }
      return { ...prev, [slotId]: { primary: null, secondary: null, showSecondary: false } };
    });
    markDirty();
  };

  const handleAdd = (slotId: string) => {
    setSlotState((prev) => {
      const cur = getSlot(slotId);
      // If primary is null — restore it, don't show secondary
      if (cur.primary === null) {
        return { ...prev, [slotId]: { primary: 0, secondary: null, showSecondary: false } };
      }
      // Primary exists — show secondary slot
      return { ...prev, [slotId]: { ...cur, secondary: 0, showSecondary: true } };
    });
    markDirty();
  };

  const getActiveSteps = (): ScenarioStep[] => {
    const steps: ScenarioStep[] = [];
    for (const s of scenario.slots) {
      const slot = getSlot(s.slot.id);
      if (slot.primary !== null) {
        const step = s.alternatives[slot.primary % s.alternatives.length];
        if (step) steps.push(step);
      }
      if (slot.secondary !== null && s.secondaryAlternatives.length > 0) {
        const step = s.secondaryAlternatives[slot.secondary % s.secondaryAlternatives.length];
        if (step) steps.push(step);
      }
    }
    return steps;
  };

  const handleSave = async () => {
    await addScenario(getActiveSteps(), selectedDate);
    setDirty(false);
    setSaved(true);
  };

  // CTA label logic
  const isSaving = saveState === "saving";
  const ctaLabel = isSaving ? "Сохраняем..." : saved && !dirty ? "Сохранено" : "Сохранить в план";
  const ctaDisabled = isSaving || (saved && !dirty);

  return (
    <div className="space-y-4">
      <ChildSwitcher selection={selection} onChange={handleSelectionChange}>{children}</ChildSwitcher>

      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-neutral-800">
          {buildScenarioHeading(selection, children)}
        </span>
      </div>
      {scenario.matchedInterests.length > 0 && (
        <p className="text-xs text-neutral-400 -mt-2">
          по интересам: {scenario.matchedInterests.slice(0, 3).join(", ")}
        </p>
      )}

      {/* Slots */}
      <div className="space-y-4">
        {scenario.slots.map((slotResult) => {
          const slot = getSlot(slotResult.slot.id);
          const primaryStep = slot.primary !== null
            ? slotResult.alternatives[slot.primary % slotResult.alternatives.length] ?? null
            : null;
          const secondaryStep = slot.secondary !== null && slotResult.secondaryAlternatives.length > 0
            ? slotResult.secondaryAlternatives[slot.secondary % slotResult.secondaryAlternatives.length] ?? null
            : null;
          const hasSecondary = slot.showSecondary || secondaryStep !== null;
          const canAddMore = !hasSecondary && slotResult.secondaryAlternatives.length > 0;

          return (
            <SlotSection
              key={slotResult.slot.id}
              slotResult={slotResult}
              primaryStep={primaryStep}
              secondaryStep={secondaryStep}
              showSecondary={hasSecondary}
              canAddMore={canAddMore}
              onReplacePrimary={() => handleReplace(slotResult.slot.id, "primary", slotResult.alternatives.length)}
              onRemovePrimary={() => handleRemove(slotResult.slot.id, "primary")}
              onReplaceSecondary={() => handleReplace(slotResult.slot.id, "secondary", slotResult.secondaryAlternatives.length)}
              onRemoveSecondary={() => handleRemove(slotResult.slot.id, "secondary")}
              onAdd={() => handleAdd(slotResult.slot.id)}
              isSaved={saved && !dirty}
            />
          );
        })}
      </div>

      {/* Conflict banner */}
      {conflict && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 space-y-3">
          <p className="text-sm font-medium text-amber-900 leading-snug">
            Можно вставить, сдвинув «{conflict.placement.conflictingTitle}»
          </p>
          <div className="flex gap-2">
            <button onClick={() => confirmConflict(selectedDate)}
              className="flex-1 h-9 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 transition-colors">
              Вставить
            </button>
            <button onClick={dismissConflict}
              className="flex-1 h-9 rounded-xl bg-white border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Primary CTA */}
      <button
        disabled={ctaDisabled}
        onClick={handleSave}
        className={cn(
          "w-full h-10 rounded-2xl text-sm font-semibold transition-all",
          saved && !dirty
            ? "bg-neutral-100 text-neutral-500 cursor-default"
            : isSaving
              ? "bg-neutral-300 text-neutral-500 cursor-not-allowed"
              : "bg-neutral-900 text-white hover:bg-neutral-700",
        )}
      >
        {saved && !dirty
          ? <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" />Сохранено</span>
          : ctaLabel
        }
      </button>
    </div>
  );
}
