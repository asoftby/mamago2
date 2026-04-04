"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar, Moon, Plus, Sun, Sunrise, X } from "lucide-react";
import { RecommendationCard } from "./RecommendationCard";
import type { PlanItemWithActivity } from "../types/event";
import type { PlanSlot, PlanSlotType } from "../hooks/useMyPlan";
import { cn } from "@/lib/utils";
import { MAX_PLAN_ITEMS_PER_SLOT } from "../lib/recommendationPool";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import type { MyPlanIdea } from "../hooks/useMyPlan";
import { useOptionalCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import { AgePanel } from "@/components/site/header/search-segments/AgePanel";
import type { AgeRangeSelection } from "@/features/filters/discovery/childrenScope.store";
import { MAX_ACTIVE_FAMILY_PERSONAS } from "@/lib/family/wholeFamilyPreset";
import { resolveFamilyAgeMode } from "@/lib/family/familyAgeMode";
import { togglePersonaId } from "@/lib/family/togglePersonaSelection";
import { toast } from "sonner";
import { WeekCalendarStrip } from "./WeekCalendarStrip";
import { publicActivityPath } from "@/lib/business/eventPublicLink";

interface PlanChildChip {
  id: string;
  name: string;
  birthDate?: string;
}

interface PlanMainContentProps {
  planSlots: PlanSlot[];
  selectedDate: string;
  onChangeDate?: (date: string) => void;
  /** legacy: not used, kept for compatibility */
  weekDates?: string[];
  planItemsByDate?: Record<string, PlanItemWithActivity[]>;
  todayIso?: string;
  layout?: "default" | "desktop";
  onAddItemToPlan?: (item: PlanItemWithActivity) => void;
  onRemoveItemFromPlan?: (itemId: string) => void;
  childrenList: PlanChildChip[];
  selectedChildIds: string[];
  onChangeSelectedChildIds: (
    childIds: string[],
    opts?: { adultIncluded?: boolean },
  ) => void;
  selectedAgeRanges: AgeRangeSelection[];
  onChangeSelectedAgeRanges: (ranges: AgeRangeSelection[]) => void;
  autoAgeValues: string[];
  /** Следующий вариант рекомендации для слота (утро/день/вечер) */
  onCycleSlotAlternative?: (periodId: PlanSlotType) => void;
  onCycleSlotAlternativePrev?: (periodId: PlanSlotType) => void;
  onMarkSlotSaved?: (slot: PlanSlotType, item: PlanItemWithActivity) => void;
  onClearSlotSaved?: (slot: PlanSlotType, itemId: string) => void;
  /** После «Добавить ещё» — показать ещё одну рекомендацию в слоте */
  onOpenSlotSuggestion?: (slot: PlanSlotType) => void;
  ideas?: MyPlanIdea[];
  ideasLoading?: boolean;
  onAddIdeaToPlan?: (idea: MyPlanIdea) => { ok: boolean; slot?: PlanSlotType };
  onRemoveIdea?: (activityId: string) => Promise<boolean> | boolean;
  /** Явно закрыть shell модалки/шита перед переходом */
  onRequestClose?: () => void;
}

const TIME_PERIODS: Array<{
  id: PlanSlotType;
  label: string;
  range: string;
  Icon: typeof Sunrise;
}> = [
  { id: "morning", label: "Утро", range: "6:00 – 12:00", Icon: Sunrise },
  { id: "afternoon", label: "День", range: "12:00 – 18:00", Icon: Sun },
  { id: "evening", label: "Вечер", range: "18:00 – 23:59", Icon: Moon },
];

const PERIOD_ORDER: PlanSlotType[] = ["morning", "afternoon", "evening"];

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function ageLabel(birthDate?: string): string {
  if (!birthDate) return "";
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return "";
  const now = new Date();
  let y = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) y -= 1;
  if (y < 0) return "";
  return `${y} лет`;
}

function toGenitiveName(name: string): string {
  const n = name.trim();
  if (!n) return name;
  const lower = n.toLowerCase();
  if (lower.endsWith("а")) {
    const base = n.slice(0, -1);
    const prev = base.slice(-1).toLowerCase();
    const ending = ["г", "к", "х", "ж", "ч", "ш", "щ"].includes(prev) ? "и" : "ы";
    return `${base}${ending}`;
  }
  if (lower.endsWith("я")) return `${n.slice(0, -1)}и`;
  if (lower.endsWith("й")) return `${n.slice(0, -1)}я`;
  if (lower.endsWith("ь")) return `${n.slice(0, -1)}я`;
  return `${n}а`;
}

function ageToGroupValue(years: number): string | null {
  const group = AGE_GROUPS.find((g) => years >= g.min && (g.max == null || years <= g.max));
  return group?.value ?? null;
}

/** «Мой план на сегодня, 30 апреля» / «…на завтра…» / «…на среду, …» */
function formatDesktopPlanHeading(selectedDate: string, todayKey: string, citySlug: string): string {
  const d = new Date(selectedDate + "T12:00:00");
  const datePart = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const tomorrowKey = addDaysIso(todayKey, 1);
  const cityPhrase = getCityLocativePhrase(citySlug);

  if (selectedDate === todayKey) {
    return `Мой план на сегодня, ${datePart} ${cityPhrase}`;
  }
  if (selectedDate === tomorrowKey) {
    return `Мой план на завтра, ${datePart} ${cityPhrase}`;
  }

  return `Мой план на ${weekdayForNa(d)}, ${datePart} ${cityPhrase}`;
}

function weekdayForNa(date: Date): string {
  const weekday = date.toLocaleDateString("ru-RU", { weekday: "long" }).toLowerCase();
  const accusativeByNa: Record<string, string> = {
    понедельник: "понедельник",
    вторник: "вторник",
    среда: "среду",
    четверг: "четверг",
    пятница: "пятницу",
    суббота: "субботу",
    воскресенье: "воскресенье",
  };
  return accusativeByNa[weekday] ?? weekday;
}

function formatMobilePlanHeadingParts(
  selectedDate: string,
  todayKey: string,
  citySlug: string,
): { firstLine: string; secondLine: string } {
  const d = new Date(selectedDate + "T12:00:00");
  const datePart = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const tomorrowKey = addDaysIso(todayKey, 1);
  const cityPhrase = getCityLocativePhrase(citySlug);

  if (selectedDate === todayKey) {
    return { firstLine: "Мой план на сегодня,", secondLine: `${datePart} ${cityPhrase}` };
  }
  if (selectedDate === tomorrowKey) {
    return { firstLine: "Мой план на завтра,", secondLine: `${datePart} ${cityPhrase}` };
  }
  return { firstLine: `Мой план на ${weekdayForNa(d)},`, secondLine: `${datePart} ${cityPhrase}` };
}

function scrollToNextPlanPeriod(current: PlanSlotType) {
  const i = PERIOD_ORDER.indexOf(current);
  const next = PERIOD_ORDER[i + 1];
  if (!next) return;
  document
    .querySelector<HTMLElement>(`[data-plan-period="${next}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function PlanMainContent({
  planSlots,
  selectedDate,
  onChangeDate,
  weekDates,
  planItemsByDate,
  todayIso,
  layout = "default",
  onAddItemToPlan,
  onRemoveItemFromPlan,
  childrenList,
  selectedChildIds,
  onChangeSelectedChildIds,
  selectedAgeRanges,
  onChangeSelectedAgeRanges,
  autoAgeValues,
  onCycleSlotAlternative,
  onCycleSlotAlternativePrev,
  onMarkSlotSaved,
  onClearSlotSaved,
  onOpenSlotSuggestion,
  ideas = [],
  ideasLoading = false,
  onAddIdeaToPlan,
  onRemoveIdea,
  onRequestClose,
}: PlanMainContentProps) {
  const params = useParams() as { city?: string };
  const pathname = usePathname();
  const router = useRouter();
  const currentSearchParams = useSearchParams();
  const cityCtx = useOptionalCity();
  const city = cityCtx?.citySlug ?? params?.city ?? "minsk";
  const family = useFamilyPersona();
  const primaryAdultPersonaId = family?.primaryAdultPersonaId ?? null;
  const adultSelected =
    !!primaryAdultPersonaId &&
    !!family?.selectedPersonaIds.includes(primaryAdultPersonaId);
  const isDesktop = layout === "desktop";
  const [removingIdeaActivityId, setRemovingIdeaActivityId] = useState<string | null>(null);

  const handleAddToPlan = (item: PlanItemWithActivity, slot: PlanSlotType) => {
    onMarkSlotSaved?.(slot, item);
    onAddItemToPlan?.(item);
  };

  const handleRemoveFromPlan = (itemId: string, slot: PlanSlotType) => {
    onClearSlotSaved?.(slot, itemId);
    onRemoveItemFromPlan?.(itemId);
  };

  const handleShowMoreAlternatives = (periodId: PlanSlotType) => {
    if (onCycleSlotAlternative) {
      onCycleSlotAlternative(periodId);
      return;
    }
    scrollToNextPlanPeriod(periodId);
  };

  const handleShowPrevAlternative = (periodId: PlanSlotType) => {
    onCycleSlotAlternativePrev?.(periodId);
  };

  const totalPlannedCount = useMemo(
    () => planSlots.reduce((sum, s) => sum + s.plannedItems.length, 0),
    [planSlots],
  );
  /** Кнопка футера только при 3+ событиях в плане (иначе не показываем) */
  const showFooterPrimaryButton = totalPlannedCount > 2;

  const dateObj = new Date(selectedDate + "T12:00:00");

  const selectedChildren = useMemo(() => {
    return childrenList.filter((c) => selectedChildIds.includes(c.id));
  }, [childrenList, selectedChildIds]);

  const profileChildIds = useMemo(
    () => childrenList.map((c) => c.id),
    [childrenList],
  );
  const ageMode = resolveFamilyAgeMode({
    hasProfileChildren:
      childrenList.length > 0 && !!family && !family.loading,
    selectedPersonaIds: family?.selectedPersonaIds ?? [],
    profileChildIds,
  });

  const whoFreeMode =
    !!family &&
    family.selectedPersonaIds.length === 0 &&
    childrenList.length > 0;

  const selectedAgeGroups = useMemo(() => {
    return Array.from(new Set(selectedAgeRanges.map((x) => x.range)));
  }, [selectedAgeRanges]);

  const selectedChildrenLabel = useMemo(() => {
    if (whoFreeMode) return "Для всех";
    if (selectedChildIds.length === 0) return "Для всех";
    const names = selectedChildren.map((c) => toGenitiveName(c.name));
    return names.length <= 1 ? `Для ${names[0] ?? "всех"}` : `Для ${names.join(" и ")}`;
  }, [
    whoFreeMode,
    childrenList.length,
    selectedChildIds.length,
    selectedChildren,
  ]);

  const returnTo = useMemo(() => {
    const q = currentSearchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [pathname, currentSearchParams]);

  const buildFindAndAddHref = (slot: PlanSlotType) => {
    const qp = new URLSearchParams();
    qp.set("from", selectedDate);
    qp.set("to", selectedDate);
    qp.set("date", selectedDate);
    if (selectedChildIds.length === 0 || selectedChildIds.length === childrenList.length) {
      qp.set("children", "all");
    } else {
      qp.set("children", selectedChildIds.join(","));
    }
    qp.set("planChildrenLabel", selectedChildrenLabel);
    qp.set("planMode", "1");
    qp.set("planDate", selectedDate);
    qp.set("timeSlot", slot);
    qp.set("returnTo", returnTo);
    if (selectedAgeGroups.length > 0) {
      qp.set("age", selectedAgeGroups.join(","));
    }
    return `/${city}/events?${qp.toString()}`;
  };

  const handleFindAndAddClick = (event: React.MouseEvent<HTMLAnchorElement>, slot: PlanSlotType) => {
    event.preventDefault();
    const href = buildFindAndAddHref(slot);
    onRequestClose?.();
    // Даем Dialog/Sheet закрыться до навигации, чтобы не оставался overlay.
    window.setTimeout(() => {
      router.push(href);
    }, 0);
  };

  const handleRemoveIdea = async (activityId: string) => {
    if (!onRemoveIdea) return;
    setRemovingIdeaActivityId(activityId);
    try {
      await onRemoveIdea(activityId);
    } finally {
      setRemovingIdeaActivityId(null);
    }
  };

  const handleIdeaOpenClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    activity: { id: string; slug?: string | null },
  ) => {
    event.preventDefault();
    const href = publicActivityPath(activity.id, city, activity.slug);
    onRequestClose?.();
    window.setTimeout(() => {
      router.push(href);
    }, 0);
  };
  const handleIdeasPageClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onRequestClose?.();
    window.setTimeout(() => {
      router.push("/ideas");
    }, 0);
  };
  const recentIdeas = useMemo(() => ideas.slice(0, 5), [ideas]);
  const allowMultiChildSelect = childrenList.length >= 2;

  const toggleChild = (childId: string) => {
    if (family?.personas?.length) {
      const allowed = new Set(family.personas.map((p) => p.id));
      const { next, limitMessage } = togglePersonaId(
        family.selectedPersonaIds,
        childId,
        allowed,
      );
      if (next === null) {
        if (limitMessage) toast(limitMessage, { duration: 4200 });
        return;
      }
      family.setSelectedPersonaIds(next);
      return;
    }
    let next: string[];
    if (allowMultiChildSelect) {
      next = selectedChildIds.includes(childId)
        ? selectedChildIds.filter((id) => id !== childId)
        : [...selectedChildIds, childId];
    } else {
      next =
        selectedChildIds.length === 1 && selectedChildIds[0] === childId
          ? []
          : [childId];
    }
    onChangeSelectedChildIds(next);
  };

  const toggleAdult = () => {
    if (!family?.primaryAdultPersonaId) return;
    const allowed = new Set(family.personas.map((p) => p.id));
    const { next, limitMessage } = togglePersonaId(
      family.selectedPersonaIds,
      family.primaryAdultPersonaId,
      allowed,
    );
    if (next === null) {
      if (limitMessage) toast(limitMessage, { duration: 4200 });
      return;
    }
    family.setSelectedPersonaIds(next);
  };

  const adultPersona = family?.personas?.find((p) => p.kind === "adult");
  const primaryAdultForPanel =
    childrenList.length > 0 && family?.primaryAdultPersonaId && adultPersona
      ? {
          id: family.primaryAdultPersonaId,
          displayName: adultPersona.displayName || "Я",
          birthDate: adultPersona.birthDate ?? undefined,
        }
      : null;

  const agePanelApplied = useMemo(() => ({ age: selectedAgeGroups } as { age: string[] }), [selectedAgeGroups]);
  const agePanelActions = useMemo(
    () => ({
      setDraft: (patch: { age?: string[] }) => {
        if (!Array.isArray(patch.age)) return;
        if (ageMode === "derived") return;
        const next = patch.age.map((range) => ({
          range,
          source: "manual" as const,
        }));
        onChangeSelectedAgeRanges(next);
      },
    }),
    [ageMode, onChangeSelectedAgeRanges],
  );

  const dayItems = planItemsByDate?.[selectedDate] ?? [];
  const showDesktopEmpty = isDesktop && dayItems.length === 0;
  const todayKey = todayIso ?? new Date().toISOString().split("T")[0];
  const mobileHeading = useMemo(
    () => formatMobilePlanHeadingParts(selectedDate, todayKey, city),
    [selectedDate, todayKey, city],
  );

  const slotForPeriod = (periodId: PlanSlotType) =>
    planSlots.find((s) => s.type === periodId);

  const sectionDayLabel = isDesktop
    ? (() => {
        const w = dateObj.toLocaleDateString("ru-RU", { weekday: "long" });
        return w.charAt(0).toUpperCase() + w.slice(1);
      })()
    : null;

  if (isDesktop) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-neutral-50">
        <div className="sticky top-0 z-20 flex-shrink-0 space-y-5 bg-neutral-50 px-8 pb-4 pt-8">
          <div className="min-w-0 space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
              {formatDesktopPlanHeading(selectedDate, todayKey, city)}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-neutral-500">
              Планируйте день и сохраняйте активности на нужные даты
            </p>
          </div>

          {onChangeDate ? (
            <WeekCalendarStrip
              selectedDate={selectedDate}
              onChangeDate={onChangeDate}
              showArrows
            />
          ) : null}

        </div>

        <div
          id="my-plan-recommendations"
          className="min-h-0 flex-1 space-y-6 overflow-y-auto scroll-mt-4 bg-white px-8 py-2"
        >
          <AgePanel
            embedded
            onClose={() => {}}
            applied={agePanelApplied as any}
            actions={agePanelActions as any}
            selectedChildIds={selectedChildIds}
            availableChildren={childrenList}
            onToggleChild={toggleChild}
            primaryAdult={primaryAdultForPanel}
            adultSelected={adultSelected}
            onToggleAdult={primaryAdultForPanel ? toggleAdult : undefined}
            ageMode={ageMode}
            autoAgeValues={autoAgeValues}
            personaPickAtLimit={
              !!family && family.selectedPersonaIds.length >= MAX_ACTIVE_FAMILY_PERSONAS
            }
            whoFreeMode={whoFreeMode}
            onSelectEveryone={
              family
                ? () => {
                    family.setSelectedPersonaIds([]);
                    onChangeSelectedAgeRanges([]);
                  }
                : undefined
            }
          />

          {sectionDayLabel ? (
            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-neutral-400">
              {sectionDayLabel}
            </p>
          ) : null}

          {showDesktopEmpty ? (
            <div className="flex flex-row items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <Calendar className="h-10 w-10 shrink-0 text-neutral-400" strokeWidth={1.25} />
              <div className="min-w-0">
                <h3 className="font-semibold text-neutral-900">Нет событий</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">
                  Добавьте событие, место или идею, чтобы собрать план дня
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="order-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-900">Ваши идеи</h3>
                  <Link
                    href="/ideas"
                    onClick={handleIdeasPageClick}
                    className="text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-700 hover:underline"
                  >
                    Смотреть все идеи
                  </Link>
                </div>
                {ideasLoading ? (
                  <p className="text-sm text-neutral-500">Загружаем идеи...</p>
                ) : recentIdeas.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-500">
                    Пока нет сохраненных идей. Нажмите на ❤️ в карточке активности, чтобы сохранить.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {recentIdeas.map((idea) => (
                      <div
                        key={idea.id}
                        className="rounded-2xl border border-neutral-200 bg-white p-3"
                      >
                        <div className="min-w-0">
                          <Link
                            href={publicActivityPath(idea.activity.id, city, idea.activity.slug)}
                            className="line-clamp-1 text-sm font-medium text-neutral-900 hover:text-neutral-700"
                            onClick={(event) => handleIdeaOpenClick(event, idea.activity)}
                          >
                            {idea.activity.title}
                          </Link>
                          <p className="line-clamp-1 text-xs text-neutral-500">
                            {idea.activity.eventCategory?.nameRu ?? "Активность"}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onAddIdeaToPlan?.(idea)}
                            disabled={idea.inPlanOnDate}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                              idea.inPlanOnDate
                                ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-neutral-300 text-neutral-700 hover:bg-neutral-50",
                            )}
                          >
                            {idea.inPlanOnDate ? "Уже в плане" : "Добавить в план"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveIdea(idea.activityId)}
                            disabled={removingIdeaActivityId === idea.activityId}
                            className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-50"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="order-1 space-y-6">
              {TIME_PERIODS.map((period) => {
                const slot = slotForPeriod(period.id);
                const PeriodIcon = period.Icon;
                return (
                  <div key={period.id} className="space-y-4" data-plan-period={period.id}>
                  <div className="flex items-center gap-2">
                    <PeriodIcon className="h-5 w-5 shrink-0 text-neutral-500" strokeWidth={1.75} aria-hidden />
                    <div className="flex items-baseline gap-2">
                      <h3 className="font-semibold text-neutral-900">{period.label}</h3>
                      <p className="text-xs text-neutral-500">{period.range}</p>
                    </div>
                  </div>

                  {slot ? (
                    <div className="space-y-3">
                      {slot.plannedItems.map((planItem) => (
                        <RecommendationCard
                          key={planItem.id}
                          item={planItem}
                          isInPlan
                          onRemoveFromPlan={() =>
                            handleRemoveFromPlan(planItem.id, period.id)
                          }
                        />
                      ))}
                      {slot.suggestionItem ? (
                        <RecommendationCard
                          key={`${period.id}-sug-${slot.suggestionItem.id}`}
                          item={slot.suggestionItem}
                          isRecommendation
                          onAddToPlan={() =>
                            handleAddToPlan(slot.suggestionItem!, period.id)
                          }
                          onShowMore={() => handleShowMoreAlternatives(period.id)}
                          onShowPrevious={() => handleShowPrevAlternative(period.id)}
                          alternativesCount={slot.alternativesCountForSuggestion}
                          variantPosition={slot.suggestionVariantPosition}
                          variantTotal={slot.suggestionVariantTotal}
                        />
                      ) : null}
                      {slot.plannedItems.length > 0 &&
                      slot.plannedItems.length < MAX_PLAN_ITEMS_PER_SLOT &&
                      !slot.suggestionItem &&
                      slot.hasMoreCandidatesForAdd ? (
                        <button
                          type="button"
                          onClick={() => onOpenSlotSuggestion?.(period.id)}
                          className="flex w-full items-center justify-center rounded-full border-2 border-[#a1a1a1] bg-white px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 [border-image:none]"
                        >
                          <Plus className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                          Добавить ещё
                        </button>
                      ) : null}
                      {slot.plannedItems.length === 0 && !slot.suggestionItem ? (
                        <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">
                          Пока ничего нет - добавьте активность или примите рекомендацию
                        </div>
                      ) : null}
                      <Link
                        href={buildFindAndAddHref(period.id)}
                        className="block w-full rounded-full border-0 bg-neutral-100 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200/80"
                        onClick={(event) => handleFindAndAddClick(event, period.id)}
                      >
                        Найти и добавить
                      </Link>
                    </div>
                  ) : null}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        {showFooterPrimaryButton ? (
          <div className="flex-shrink-0 space-y-3 border-t border-neutral-200 bg-white px-8 py-5">
            <Button
              asChild
              className="h-12 w-full bg-neutral-900 text-base font-semibold hover:bg-neutral-800"
            >
              <Link href={`/me/day/${selectedDate}`}>Сценарий дня</Link>
            </Button>
            <p className="text-center text-xs text-neutral-500">
              Вы сможете менять рекомендации в любой момент
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-50">
      <div className="flex-shrink-0 border-b border-neutral-200 bg-white/95 px-4 pb-3 pt-6 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">
              {mobileHeading.firstLine}
            </h2>
            <p className="mt-0 text-lg font-semibold leading-[1.05] text-gray-900">
              {mobileHeading.secondLine}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRequestClose?.()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Закрыть мой план"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {onChangeDate ? (
        <div className="flex-shrink-0 border-b border-neutral-200 bg-white px-4 pb-[18px] pt-[17px]">
          <WeekCalendarStrip
            selectedDate={selectedDate}
            onChangeDate={onChangeDate}
            compact
          />
        </div>
      ) : null}

      <div
        id="my-plan-recommendations"
        className="flex-1 space-y-6 overflow-y-auto scroll-mt-4 bg-white px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex flex-col gap-5">
          <AgePanel
            embedded
            onClose={() => {}}
            applied={agePanelApplied as any}
            actions={agePanelActions as any}
            selectedChildIds={selectedChildIds}
            availableChildren={childrenList}
            onToggleChild={toggleChild}
            primaryAdult={primaryAdultForPanel}
            adultSelected={adultSelected}
            onToggleAdult={primaryAdultForPanel ? toggleAdult : undefined}
            ageMode={ageMode}
            autoAgeValues={autoAgeValues}
            personaPickAtLimit={
              !!family && family.selectedPersonaIds.length >= MAX_ACTIVE_FAMILY_PERSONAS
            }
            whoFreeMode={whoFreeMode}
            onSelectEveryone={
              family
                ? () => {
                    family.setSelectedPersonaIds([]);
                    onChangeSelectedAgeRanges([]);
                  }
                : undefined
            }
          />
          <div className="order-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">Ваши идеи</h3>
              <Link
                href="/ideas"
                onClick={handleIdeasPageClick}
                className="text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-700 hover:underline"
              >
                Смотреть все идеи
              </Link>
            </div>
            {ideasLoading ? (
              <p className="text-sm text-neutral-500">Загружаем идеи...</p>
            ) : recentIdeas.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-500">
                Пока нет сохраненных идей. Нажмите на ❤️ в карточке активности, чтобы сохранить.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {recentIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={publicActivityPath(idea.activity.id, city, idea.activity.slug)}
                        className="line-clamp-1 text-sm font-medium text-neutral-900 hover:text-neutral-700"
                        onClick={(event) => handleIdeaOpenClick(event, idea.activity)}
                      >
                        {idea.activity.title}
                      </Link>
                      <p className="line-clamp-1 text-xs text-neutral-500">
                        {idea.activity.eventCategory?.nameRu ?? "Активность"}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAddIdeaToPlan?.(idea)}
                        disabled={idea.inPlanOnDate}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          idea.inPlanOnDate
                            ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-neutral-300 text-neutral-700 hover:bg-neutral-50",
                        )}
                      >
                        {idea.inPlanOnDate ? "Уже в плане" : "Добавить в план"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveIdea(idea.activityId)}
                        disabled={removingIdeaActivityId === idea.activityId}
                        className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-50"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        <div className="order-1 space-y-5">
        {TIME_PERIODS.map((period) => {
          const slot = planSlots.find((s) => s.type === period.id);
          const PeriodIcon = period.Icon;

          return (
            <div key={period.id} className="space-y-4" data-plan-period={period.id}>
              <div className="flex items-center gap-2">
                <PeriodIcon className="h-5 w-5 shrink-0 text-neutral-500" strokeWidth={1.75} aria-hidden />
                <div className="flex items-baseline gap-2">
                  <h3 className="font-semibold text-gray-900">{period.label}</h3>
                  <p className="text-xs text-gray-500">{period.range}</p>
                </div>
              </div>

              {slot ? (
                <div className="space-y-3">
                  {slot.plannedItems.map((planItem) => (
                    <RecommendationCard
                      key={planItem.id}
                      item={planItem}
                      isInPlan
                      onRemoveFromPlan={() =>
                        handleRemoveFromPlan(planItem.id, period.id)
                      }
                    />
                  ))}
                  {slot.suggestionItem ? (
                    <RecommendationCard
                      key={`${period.id}-sug-${slot.suggestionItem.id}`}
                      item={slot.suggestionItem}
                      isRecommendation
                      onAddToPlan={() =>
                        handleAddToPlan(slot.suggestionItem!, period.id)
                      }
                      onShowMore={() => handleShowMoreAlternatives(period.id)}
                      onShowPrevious={() => handleShowPrevAlternative(period.id)}
                      alternativesCount={slot.alternativesCountForSuggestion}
                      variantPosition={slot.suggestionVariantPosition}
                      variantTotal={slot.suggestionVariantTotal}
                    />
                  ) : null}
                  {slot.plannedItems.length > 0 &&
                  slot.plannedItems.length < MAX_PLAN_ITEMS_PER_SLOT &&
                  !slot.suggestionItem &&
                  slot.hasMoreCandidatesForAdd ? (
                    <button
                      type="button"
                      onClick={() => onOpenSlotSuggestion?.(period.id)}
                      className="flex w-full items-center justify-center rounded-full border-2 border-[#a1a1a1] bg-white px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 [border-image:none]"
                    >
                      <Plus className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                      Добавить ещё
                    </button>
                  ) : null}
                  {slot.plannedItems.length === 0 && !slot.suggestionItem ? (
                    <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">
                      Пока ничего нет - добавьте активность или примите рекомендацию
                    </div>
                  ) : null}
                  <Link
                    href={buildFindAndAddHref(period.id)}
                    className="block w-full rounded-full border-0 bg-neutral-100 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200/80"
                    onClick={(event) => handleFindAndAddClick(event, period.id)}
                  >
                    Найти и добавить
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
        </div>
        </div>
      </div>

      {showFooterPrimaryButton ? (
        <div className="flex-shrink-0 space-y-3 border-t bg-white px-6 py-4">
          <Button
            asChild
            className="h-12 w-full bg-gray-900 text-base font-semibold hover:bg-gray-800"
          >
            <Link href={`/me/day/${selectedDate}`}>Сценарий дня</Link>
          </Button>
          <p className="text-center text-xs text-gray-500">
            Вы сможете менять рекомендации в любой момент
          </p>
        </div>
      ) : null}
    </div>
  );
}
