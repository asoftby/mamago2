"use client";

import { useMemo, useState } from "react";
import type { BirthdayBuilderWithGate } from "../hooks/useBirthdayBuilderWithGate";
import { getBudgetEstimate } from "../../lib/getBudgetEstimate";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSystemInterestLabel } from "@/lib/config/interests";
import { getDisplayedAgeLabel } from "../lib/ageSignalMapper";
import { birthdayOffers } from "../../data/birthdayOffers";
import type { BirthdayBudgetGroup, OfferLayer } from "../../types/birthday";
import type { BuilderStep, OfferConflict } from "../types/builder";
import { getBudgetRange, formatBudgetRange } from "../lib/budgetRanges";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

type BuilderHook = BirthdayBuilderWithGate;

const GUESTS_LABELS: Record<string, string> = {
  up5: "до 5 детей",
  "5-10": "5–10 детей",
  "10-15": "10–15 детей",
  "15plus": "15+ детей",
};

const PLACE_FORMAT_LABELS: Record<string, string> = {
  HOME: "Дома",
  VENUE: "В заведении",
  OUTDOOR: "На природе",
};
const THEME_LABELS: Record<string, string> = {
  princess: "Принцессы",
  superhero: "Супергерои",
  dinosaur: "Динозавры",
  unicorn: "Единороги",
  pirate: "Пираты",
  science: "Наука",
  art: "Творчество",
  sport: "Спорт",
  any: "Любая",
};

const NEXT_STEP_PHRASE: Partial<Record<BuilderStep, string>> = {
  intro: "тематика",
  theme: "бюджет",
  budget: "гости",
  extras: "где отмечать",
  place: "развлечения",
  entertainment: "еда и торты",
  food: "декор",
  decor: "итогу",
};

function hasAddonInLayer(selectedAddonIds: string[], layer: OfferLayer): boolean {
  return selectedAddonIds.some((id) => {
    const o = birthdayOffers.find((x) => x.id === id);
    return o?.layer === layer;
  });
}

/** Короткий статус для строки: «В пределах бюджета» / «Выше бюджета» */
function getBudgetStatusShort(
  totalPrice: number,
  budgetGroup: BirthdayBudgetGroup | null
): string | null {
  const range = getBudgetRange(budgetGroup);
  if (!range || !budgetGroup || budgetGroup === "unknown") return null;
  if (totalPrice > range.max) return "Выше бюджета";
  return "В пределах бюджета";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3 sm:justify-between py-2 border-b border-border/60 last:border-0 last:pb-0">
      <span className="text-xs font-medium text-muted-foreground shrink-0 leading-5">
        {label}
      </span>
      <span className="text-sm text-foreground text-right sm:max-w-[70%] leading-5">{value}</span>
    </div>
  );
}

interface BirthdayBuilderStickyBarProps {
  builder: BuilderHook;
}

export function BirthdayBuilderStickyBar({ builder }: BirthdayBuilderStickyBarProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const {
    state,
    selectedBase,
    selectedAddons,
    allSelectedOffers,
    hasValidBase,
    nextStep,
    prevStep,
    resetBuilder,
  } = builder;
  const { currentStep } = state.ui;
  const {
    ageGroup,
    selectedAgeLabel,
    budgetGroup,
    guestsGroup,
    theme,
    placeType,
    partyForChild,
  } = state.quiz;
  const { conflicts } = state.validation;
  const { selectedBaseId, selectedAddonIds } = state.selection;

  const hasConflicts = conflicts.length > 0;

  const baseLabel = useMemo(() => {
    if (selectedBase) return selectedBase.title;
    if (placeType === "HOME") return "Дома";
    if (placeType === "OUTDOOR") return "На природе";
    return null;
  }, [selectedBase, placeType]);

  const conflictIds = useMemo(
    () => new Set(conflicts.map((c: OfferConflict) => c.offerId)),
    [conflicts]
  );
  const validOffers = useMemo(
    () => allSelectedOffers.filter((o) => !conflictIds.has(o.id)),
    [allSelectedOffers, conflictIds]
  );
  const totalPrice = useMemo(() => {
    const v = getBudgetEstimate(validOffers, budgetGroup);
    return v ?? 0;
  }, [validOffers, budgetGroup]);

  const hasStepSelection = useMemo(() => {
    switch (currentStep) {
      case "intro":
        return !!ageGroup;
      case "theme":
        return !!theme;
      case "budget":
        return !!budgetGroup && budgetGroup !== "unknown";
      case "place":
        if (!placeType) return false;
        if (placeType === "VENUE") return !!selectedBaseId;
        return true;
      case "extras":
        return !!guestsGroup;
      case "entertainment":
        return hasAddonInLayer(selectedAddonIds, "ENTERTAINMENT");
      case "food":
        return hasAddonInLayer(selectedAddonIds, "FOOD");
      case "decor":
        return hasAddonInLayer(selectedAddonIds, "DECOR");
      case "summary":
        return hasValidBase && !hasConflicts;
      default:
        return true;
    }
  }, [
    currentStep,
    ageGroup,
    theme,
    budgetGroup,
    placeType,
    selectedBaseId,
    guestsGroup,
    selectedAddonIds,
    hasValidBase,
    hasConflicts,
  ]);

  const canProceedForward = useMemo(() => {
    switch (currentStep) {
      case "intro":
        return true;
      case "theme":
        return true;
      case "budget":
        return !!budgetGroup && budgetGroup !== "unknown";
      case "place":
        return placeType === "HOME" || placeType === "OUTDOOR"
          ? !!placeType
          : !!selectedBaseId;
      case "extras":
      case "entertainment":
      case "food":
      case "decor":
        return true;
      case "summary":
        return hasValidBase && !hasConflicts;
      case "confirm":
        return true;
      default:
        return false;
    }
  }, [
    currentStep,
    budgetGroup,
    placeType,
    selectedBaseId,
    hasValidBase,
    hasConflicts,
  ]);

  const showBack = currentStep !== "intro";

  const forwardBlock = useMemo(() => {
    if (currentStep === "confirm") {
      return { show: false as const };
    }

    if (currentStep === "summary") {
      return {
        show: true as const,
        label: "Праздник готов — отправить заявки",
        isPrimary: true as const,
        disabled: !canProceedForward,
        onClick: nextStep,
      };
    }

    const phrase = NEXT_STEP_PHRASE[currentStep];
    if (!phrase) {
      return { show: false as const };
    }

    if (!hasStepSelection) {
      return {
        show: true as const,
        label: "Пропустить",
        isPrimary: false as const,
        disabled: false,
        onClick: nextStep,
      };
    }

    return {
      show: true as const,
      label: `Далее — ${phrase}`,
      isPrimary: true as const,
      disabled: !canProceedForward,
      onClick: nextStep,
    };
  }, [currentStep, hasStepSelection, canProceedForward, nextStep]);

  /** Детальные подписи для раскрытия */
  const detailRows = useMemo(() => {
    const childText = partyForChild
      ? `${partyForChild.name} · ${partyForChild.ageLabel}`
      : "—";
    const interestsText =
      partyForChild?.interestSlugs && partyForChild.interestSlugs.length > 0
        ? partyForChild.interestSlugs.map((s) => getSystemInterestLabel(s)).join(", ")
        : "—";
    const ageText = ageGroup
      ? getDisplayedAgeLabel({ ageGroup, selectedAgeLabel }) ?? "—"
      : "—";
    const budgetText =
      budgetGroup && budgetGroup !== "unknown"
        ? formatBudgetRange(budgetGroup) + " BYN"
        : "—";
    let placeText = "—";
    if (placeType === "VENUE" && selectedBase) placeText = selectedBase.title;
    else if (placeType === "HOME" || placeType === "OUTDOOR")
      placeText = PLACE_FORMAT_LABELS[placeType] ?? placeType;
    else if (placeType === "VENUE") placeText = PLACE_FORMAT_LABELS.VENUE;
    const guestsText = guestsGroup ? GUESTS_LABELS[guestsGroup] ?? guestsGroup : "—";
    const themeText = theme ? THEME_LABELS[theme] ?? theme : "—";
    const addonsText =
      selectedAddons.length > 0
        ? selectedAddons.map((a) => a.title).join(", ")
        : "—";
    return { childText, interestsText, ageText, budgetText, placeText, guestsText, themeText, addonsText };
  }, [
    partyForChild,
    ageGroup,
    selectedAgeLabel,
    budgetGroup,
    placeType,
    selectedBase,
    guestsGroup,
    theme,
    selectedAddons,
  ]);

  const barBudgetStatus = useMemo(
    () => getBudgetStatusShort(totalPrice, budgetGroup),
    [totalPrice, budgetGroup]
  );

  const compactSummaryParts = useMemo(() => {
    const ageShort = ageGroup
      ? getDisplayedAgeLabel({ ageGroup, selectedAgeLabel }) ?? "—"
      : "—";
    const budgetShort =
      budgetGroup && budgetGroup !== "unknown"
        ? formatBudgetRange(budgetGroup)
        : "—";
    const totalRounded = Math.round(totalPrice);
    return { ageShort, budgetShort, totalRounded, status: barBudgetStatus };
  }, [ageGroup, selectedAgeLabel, budgetGroup, totalPrice, barBudgetStatus]);

  const addonsCount = selectedAddons.length;

  /** Есть ли что сбрасывать (возраст, бюджет, место, гости, тема, площадка, услуги) */
  const hasAnyBuilderData = useMemo(() => {
    const q = state.quiz;
    const s = state.selection;
    return (
      !!q.partyForChild ||
      !!q.ageGroup ||
      (!!q.budgetGroup && q.budgetGroup !== "unknown") ||
      !!q.placeType ||
      !!q.guestsGroup ||
      !!q.theme ||
      !!s.selectedBaseId ||
      s.selectedAddonIds.length > 0
    );
  }, [state.quiz, state.selection]);

  /** Нет выбранных параметров — дружелюбный empty state вместо «— · — · 0 BYN» */
  const isEmptySummary = !hasAnyBuilderData;

  const summaryTrigger = (
    <button
      type="button"
      onClick={() => setSummaryOpen((o) => !o)}
      aria-expanded={summaryOpen}
      aria-label={
        isEmptySummary
          ? "Параметры праздника — начните выбор"
          : "Параметры праздника, сводка выбора"
      }
      className={cn(
        "group flex w-full min-w-0 rounded-lg px-1 py-1.5 -mx-1 text-left transition-colors",
        "min-h-[44px] cursor-pointer hover:bg-black/[0.04] active:bg-black/[0.06]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/35 focus-visible:ring-offset-2",
        isEmptySummary ? "items-start" : "items-start sm:items-center"
      )}
    >
      {isEmptySummary ? (
        <span className="min-w-0 flex-1 flex flex-col gap-0.5 pr-1">
          <span className="text-[13px] sm:text-sm font-medium text-foreground leading-snug">
            Начнём собирать праздник 🎉
          </span>
          <span className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
            Цена появится после выбора
          </span>
        </span>
      ) : (
        <>
          <span
            className={cn(
              "min-w-0 flex-1 flex flex-col gap-1 sm:hidden text-[13px] text-foreground/90 tabular-nums",
              "underline decoration-dashed decoration-[#EF8759] underline-offset-[4px]",
            )}
          >
            <span className="flex flex-wrap items-center gap-x-1 min-w-0">
              {partyForChild && (
                <>
                  <span className="text-muted-foreground">{partyForChild.name}</span>
                  <span className="text-muted-foreground/50">·</span>
                </>
              )}
              <span className="text-muted-foreground">
                {compactSummaryParts.ageShort}
              </span>
              {guestsGroup ? (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-muted-foreground">
                    {GUESTS_LABELS[guestsGroup] ?? guestsGroup}
                  </span>
                </>
              ) : null}
            </span>
            <span className="flex flex-wrap items-center gap-x-1 min-w-0">
              <span className="text-muted-foreground">{compactSummaryParts.budgetShort}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="font-medium text-foreground">
                {compactSummaryParts.totalRounded} BYN
              </span>
              {compactSummaryParts.status && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span
                    className={cn(
                      "text-[12px]",
                      compactSummaryParts.status === "Выше бюджета"
                        ? "text-red-600 font-medium"
                        : "text-emerald-700",
                    )}
                  >
                    {compactSummaryParts.status}
                  </span>
                </>
              )}
              {hasConflicts && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="inline-flex items-center gap-0.5 text-amber-700 text-[12px] font-medium">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    конфликты
                  </span>
                </>
              )}
            </span>
          </span>
          <span
            className={cn(
              "hidden sm:block min-w-0 flex-1 truncate text-sm text-foreground/90 tabular-nums",
              "underline decoration-dashed decoration-[#EF8759] underline-offset-[4px]",
            )}
          >
            {partyForChild && (
              <>
                <span className="text-muted-foreground">{partyForChild.name}</span>
                <span className="text-muted-foreground/50"> · </span>
              </>
            )}
            <span className="text-muted-foreground">
              {compactSummaryParts.ageShort}
            </span>
            <span className="text-muted-foreground/50"> · </span>
            {guestsGroup ? (
              <>
                <span className="text-muted-foreground">
                  {GUESTS_LABELS[guestsGroup] ?? guestsGroup}
                </span>
                <span className="text-muted-foreground/50"> · </span>
              </>
            ) : null}
            <span className="text-muted-foreground">{compactSummaryParts.budgetShort}</span>
            <span className="text-muted-foreground/50"> · </span>
            <span className="font-medium text-foreground">
              {compactSummaryParts.totalRounded} BYN
            </span>
            {compactSummaryParts.status && (
              <>
                <span className="text-muted-foreground/50"> · </span>
                <span
                  className={cn(
                    "text-[13px]",
                    compactSummaryParts.status === "Выше бюджета"
                      ? "text-red-600 font-medium"
                      : "text-emerald-700",
                  )}
                >
                  {compactSummaryParts.status}
                </span>
              </>
            )}
            {hasConflicts && (
              <>
                <span className="text-muted-foreground/50"> · </span>
                <span className="inline-flex items-center gap-0.5 text-amber-700 text-[12px] font-medium">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  конфликты
                </span>
              </>
            )}
          </span>
        </>
      )}
    </button>
  );

  const summaryDetailsBody = isEmptySummary ? (
    <div className="space-y-2 px-1 pb-1">
      <p className="text-sm font-medium text-foreground leading-snug">
        Начнём собирать праздник 🎉
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Цена появится после выбора возраста, бюджета и формата — здесь будет сводка и сумма.
      </p>
    </div>
  ) : (
    <div className="space-y-0 px-1">
      <DetailRow label="Для кого" value={detailRows.childText} />
      <DetailRow label="Интересы" value={detailRows.interestsText} />
      <DetailRow label="Возраст" value={detailRows.ageText} />
      <DetailRow label="Бюджет" value={detailRows.budgetText} />
      <DetailRow label="Место" value={detailRows.placeText} />
      <DetailRow label="Гости" value={detailRows.guestsText} />
      <DetailRow label="Тема" value={detailRows.themeText} />
      <DetailRow
        label="Доп. услуги"
        value={
          addonsCount > 0
            ? `${addonsCount}: ${detailRows.addonsText}`
            : baseLabel
              ? "Без дополнительных услуг"
              : "—"
        }
      />
      <div className="border-t border-border/80 pt-2">
        <div className="flex justify-between items-baseline gap-2 text-sm">
          <span className="text-muted-foreground">Сумма выбранного</span>
          <span className="font-semibold tabular-nums">{Math.round(totalPrice)} BYN</span>
        </div>
        {barBudgetStatus && (
          <p
            className={cn(
              "text-xs mt-1",
              barBudgetStatus === "Выше бюджета" ? "text-red-600" : "text-emerald-700"
            )}
          >
            {barBudgetStatus}
          </p>
        )}
      </div>
      {hasConflicts && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mt-3 text-xs text-amber-900">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Есть несовместимые предложения
          </p>
          <ul className="mt-2 space-y-1 pl-1">
            {conflicts.map((c) => (
              <li key={c.offerId}>• {c.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40",
        // Sheet overlay + content are z-50; без подъёма панели второй клик по строке попадает в sheet, а не в кнопку
        summaryOpen && isMobile && "z-[60]",
        "bg-white/95 backdrop-blur-md border-t border-black/[0.08]",
        "pb-[env(safe-area-inset-bottom)]",
        "shadow-[0_-1px_0_rgba(0,0,0,0.06),0_-8px_32px_rgba(0,0,0,0.06)]"
      )}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 flex items-center">
            {isMobile ? (
              <>
                {summaryTrigger}
                <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
                  <SheetContent
                    side="bottom"
                    className="rounded-t-2xl max-h-[85vh] overflow-y-auto bg-white"
                    showCloseButton
                  >
                    <SheetHeader className="text-left pb-2 space-y-0">
                      <div className="flex items-start justify-between gap-2 pr-12">
                        <SheetTitle className="text-left text-base font-semibold leading-snug">
                          Параметры праздника
                        </SheetTitle>
                        {hasAnyBuilderData && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSummaryOpen(false);
                              setResetDialogOpen(true);
                            }}
                            className={cn(
                              "text-[11px] font-medium text-muted-foreground shrink-0 mt-0.5",
                              "px-1.5 py-0.5 rounded-md -mr-1",
                              "hover:text-foreground transition-colors",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/30 focus-visible:ring-offset-1"
                            )}
                            aria-label="Сбросить все параметры"
                          >
                            Сбросить
                          </button>
                        )}
                      </div>
                      <SheetDescription className="sr-only">
                        Подробности выбора: возраст, бюджет, место, гости, тема и услуги
                      </SheetDescription>
                    </SheetHeader>
                    {summaryDetailsBody}
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <Popover open={summaryOpen} onOpenChange={setSummaryOpen}>
                <PopoverAnchor asChild>{summaryTrigger}</PopoverAnchor>
                <PopoverContent
                  side="top"
                  align="start"
                  sideOffset={10}
                  className="w-[min(100vw-2rem,380px)] p-4 bg-white"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide min-w-0 flex-1 leading-snug">
                      Параметры праздника
                    </p>
                    {hasAnyBuilderData && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSummaryOpen(false);
                          setResetDialogOpen(true);
                        }}
                        className={cn(
                          "text-[11px] font-medium text-muted-foreground shrink-0 mt-0.5",
                          "px-1.5 py-0.5 rounded-md -mr-1",
                          "hover:text-foreground transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/30 focus-visible:ring-offset-1"
                        )}
                        aria-label="Сбросить все параметры"
                      >
                        Сбросить
                      </button>
                    )}
                  </div>
                  {summaryDetailsBody}
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0 self-center">
            {showBack && (
              <button
                type="button"
                onClick={prevStep}
                className={cn(
                  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-4 sm:px-5",
                  "bg-zinc-100 text-sm font-semibold text-zinc-600 transition-colors",
                  "hover:bg-zinc-200/90 hover:text-zinc-800",
                  "active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/40 focus-visible:ring-offset-2"
                )}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} />
                Назад
              </button>
            )}

            {forwardBlock.show && (
              <button
                type="button"
                onClick={forwardBlock.onClick}
                disabled={forwardBlock.disabled}
                className={cn(
                  "min-h-[44px] rounded-lg px-5 sm:px-6 text-sm font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/40 focus-visible:ring-offset-2",
                  "disabled:opacity-50 disabled:pointer-events-none",
                  forwardBlock.isPrimary
                    ? "bg-[#EF8759] text-white hover:bg-[#e07848] shadow-sm"
                    : "border border-border bg-white text-foreground hover:bg-muted/50"
                )}
              >
                {forwardBlock.label}
              </button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Сбросить все параметры?</AlertDialogTitle>
            <AlertDialogDescription>Вы начнёте заново</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Отмена</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                resetBuilder();
                setSummaryOpen(false);
              }}
            >
              Сбросить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
