"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { showFamilyUi, type FamilyView } from "@/features/my-plan/lib/planVisibilityView";
import type { PlanBookingState } from "@/server/family/planBookingPure";
import { Container } from "@/components/ui/Container";
import { PlanCalendar, invalidatePlanDayMarkers } from "@/features/plan-calendar";
import { PlanPersonFilter, planPersonFilterOptions } from "@/features/my-plan/components/PlanPersonFilter";
import { useSharedPlanAudienceFilters } from "@/features/my-plan/hooks/useSharedPlanAudienceFilters";
import { filterVisiblePlanEntries, type PlanPersonSelection } from "@/features/my-plan/lib/filterPlanEntriesByPerson";
import { PlanDayList } from "./PlanDayList";
import { PlanOverviewDialog } from "./PlanOverviewDialog";
import { PlanProfileCompletionGate } from "./PlanProfileCompletionGate";
import type { PlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";
import {
  ExperienceCheckIn,
  type ExperienceCheckInCandidate,
  type ExperienceCheckInState,
} from "./ExperienceCheckIn";
import { PastPlanArchive } from "./PastPlanArchive";
import type { PastPlanEntry } from "@/server/services/experience/pastPlanEntries.service";
import { ManualPlanEntryDialog } from "./ManualPlanEntryDialog";
import { PlanNewTaskDialog } from "./PlanNewTaskDialog";
import { PlanStickyCounter } from "@/features/my-plan/components/PlanStickyCounter";
import { addDays, monthName, startOfWeek, todayKey } from "@/lib/date/dateKey";
import {
  shouldFetchCalendarWeek,
  upsertCalendarWeekItem,
  scenarioStatusesAfterManualSave,
  scenarioStatusesAfterManualCancel,
} from "@/features/my-plan/lib/familyCalendarNavigation";
import {
  filterFamilyCalendarItems,
  findFamilyCalendarConflictIds,
} from "@/features/my-plan/lib/familyCalendar";
import { toast } from "@/lib/toast";

export type SerializedPlanItem = {
  id: string;
  source: "CATALOG" | "TELEGRAM_FORWARD" | "MANUAL";
  entryType: "EVENT" | "ACTIVITY" | "TASK" | null;
  date: string;
  /** Raw, authoritative source time — never mutated to reflect a Scenario
   * override. Presentation should read `effectiveStartsAt` instead. */
  startsAt: string | null;
  /** Time to display: `startsAt` if set, else a Scenario-assigned override
   * for this item, else null (untimed). See `resolveMyPlanItemEffectiveTime`. */
  effectiveStartsAt: string | null;
  endsAt: string | null;
  dueAt: string | null;
  dueHasTime: boolean;
  activityId: string | null;
  offerId?: string | null;
  recurrenceSeriesId?: string | null;
  recurrenceDate?: string | null;
  offer?: { id: string; slug: string | null; title: string; place: { city: { slug: string } | null } | null } | null;
  title: string | null;
  childId: string | null;
  assigneeUserId?: string | null;
  childName: string | null;
  locationText: string | null;
  notes: string | null;
  tags?: string[];
  reminderEnabled?: boolean | null;
  coverImageUrl: string | null;
  /** Family Core M4b. Absent on items added client-side before a reload (= own, shared). */
  visibility?: "PRIVATE" | "FAMILY";
  status?: "PROPOSED" | "CONFIRMED" | "CANCELLED";
  authorId?: string;
  authorName?: string | null;
  /** Family Core M6: safe booking state (never contains contacts). */
  booking?: PlanBookingState | null;
  /** Version for edit-conflict checks (ISO). */
  updatedAt?: string;
  planAvailability?: PlanActivityPublicAvailability;
  activity: {
    id: string;
    slug: string | null;
    title: string;
    type: string;
    coverImageUrl: string | null;
    ageLabel: string | null;
    categoryLabel: string | null;
    priceLabel: string | null;
    venueName: string | null;
    venueAddress: string | null;
  } | null;
};

export type SerializedIdea = {
  id: string;
  activityId: string;
  createdAt: string;
  activity: {
    id: string;
    title: string;
    coverImageUrl: string | null;
    type: string;
    ageLabel: string | null;
    slug: string | null;
  } | null;
};

type Props = {
  initialItems: SerializedPlanItem[];
  /** Non-null only for a family with 2+ active adults (flag FAMILY_CORE_READS on). */
  familyView?: FamilyView | null;
  currentUserId: string;
  initialSelectedDate: string;
  initialRange: { from: string; to: string };
  familyChildren: Array<{ id: string; name: string }>;
  familyAdults: Array<{ id: string; name: string; avatarUrl?: string | null }>;
  accountDisplayName?: string | null;
  ideaActivityIds: string[];
  childrenAges: number[];
  initialIdeas?: SerializedIdea[];
  /** date -> Scenario status; absent entries mean no Scenario exists yet. */
  scenarioStatusByDate?: Record<string, "ready" | "changed">;
  experienceCandidates?: ExperienceCheckInCandidate[];
  recentExperiences?: ExperienceCheckInState[];
  pastEntries?: PastPlanEntry[];
  pastEntriesHasNext?: boolean;
  pastEntriesPage?: number;
  activeReminder?: {
    id: string;
    title: string;
    body: string;
    ctaLabel: string | null;
    ctaAction: string | null;
    createdAt: string;
    isRead: boolean;
  } | null;
};

function itemForCacheMessage(item: SerializedPlanItem): string {
  return item.source === "MANUAL" ? "Календарь обновлён" : "План обновлён";
}

function pluralizeEvents(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "событие";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "события";
  return "событий";
}

function formatNearestWeekItem(date: string, todayISO: string): string {
  if (date === todayISO) return "сегодня";
  if (date === addDays(todayISO, 1)) return "завтра";
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString("ru-RU", { weekday: "long" });
}

function IdeasRow({ count }: { count: number }) {
  return (
    <>
      <div className="mt-8 mb-3.5 flex items-center gap-3.5" aria-hidden>
        <i className="h-px flex-1 bg-[#DCD4C9]" />
        <span className="font-serif text-[21px] italic text-[#6F675E]">или без даты</span>
        <i className="h-px flex-1 bg-[#DCD4C9]" />
      </div>
      <Link
        href="/me/ideas"
        className="group flex min-h-20 w-full items-center gap-3.5 rounded-[22px] border border-[#ECE6DD] bg-[#F8F5EF] py-3 pr-[18px] pl-3.5 no-underline transition-colors hover:border-[#141210] hover:bg-white"
      >
        <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full border border-[#DCD4C9] bg-white text-[#141210]">
          <Heart className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#141210]">
            Мои идеи{count > 0 ? ` · ${count}` : ""}
          </span>
          <span className="mt-0.5 block text-sm text-[#6F675E]">
            {count > 0 ? "Поставьте на свободный день" : "Сохраняйте активности в идеи — они появятся здесь"}
          </span>
        </span>
        <ArrowRight
          className="h-[18px] w-[18px] shrink-0 text-[#6F675E] transition-[transform,color] group-hover:translate-x-[3px] group-hover:text-[#C24E22]"
          aria-hidden
        />
      </Link>
    </>
  );
}

export function PlanPageClient({
  initialItems,
  familyView = null,
  currentUserId,
  initialSelectedDate,
  initialRange,
  familyChildren,
  familyAdults,
  accountDisplayName,
  initialIdeas = [],
  scenarioStatusByDate = {},
  experienceCandidates = [],
  recentExperiences = [],
  pastEntries = [],
  pastEntriesHasNext = false,
  pastEntriesPage = 0,
}: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  // The server resolved a different ?date= (e.g. «Открыть весь план» from the widget while already here).
  const [seenInitialDate, setSeenInitialDate] = useState(initialSelectedDate);
  if (seenInitialDate !== initialSelectedDate) {
    setSeenInitialDate(initialSelectedDate);
    setSelectedDate(initialSelectedDate);
  }
  const [itemsByWeek, setItemsByWeek] = useState<Record<string, SerializedPlanItem[]>>({
    [initialRange.from]: initialItems,
  });
  const [scenarioStatuses, setScenarioStatuses] = useState(scenarioStatusByDate);
  const [loadingWeek, setLoadingWeek] = useState<string | null>(null);
  const { filters: audienceFilters, update: updateAudienceFilters } = useSharedPlanAudienceFilters(currentUserId);
  const includedPeople = audienceFilters.include;
  const excludedPeople = audienceFilters.exclude;
  const visibilityFilter = audienceFilters.visibility;
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editingManualItem, setEditingManualItem] = useState<SerializedPlanItem | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(pastEntriesPage > 0);
  // Pagination links can navigate directly to the archive, including after a reload.
  useEffect(() => {
    if (searchParams.has("historyPage")) setArchiveOpen(true);
  }, [searchParams]);
  const familyUi = showFamilyUi(familyView);
  // Single audience source of truth: obsolete legacy scope must not silently
  // narrow entries when the visible participant chips say "Все доступные".
  // Server data is the source of truth after a refresh (e.g. after a conflict).
  useEffect(() => {
    setItemsByWeek({ [initialRange.from]: initialItems });
  }, [initialItems, initialRange.from]);

  const items = useMemo(() => Object.values(itemsByWeek).flat(), [itemsByWeek]);
  const visibleItems = items;

  const loadWeek = useCallback(async (date: string, options: { force?: boolean } = {}) => {
    const from = startOfWeek(date);
    if ((!options.force && !shouldFetchCalendarWeek(itemsByWeek, date)) || loadingWeek === from) return;
    const to = addDays(from, 6);
    setLoadingWeek(from);
    try {
      const response = await fetch(`/api/plan/calendar?from=${from}&to=${to}`);
      const payload = await response.json() as {
        items?: SerializedPlanItem[];
        scenarioStatusByDate?: Record<string, "ready" | "changed">;
      };
      if (!response.ok || !payload.items) throw new Error("calendar_load_failed");
      setItemsByWeek((current) => ({ ...current, [from]: payload.items! }));
      setScenarioStatuses((current) => ({ ...current, ...(payload.scenarioStatusByDate ?? {}) }));
    } catch {
      toast.error("Не удалось загрузить неделю");
    } finally {
      setLoadingWeek(null);
    }
  }, [itemsByWeek, loadingWeek]);

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    // Shallow update: keeps ?date= in the URL without re-running the server page.
    window.history.replaceState(window.history.state, "", `${pathname}?${params.toString()}`);
    void loadWeek(date, { force: true });
  }, [loadWeek, pathname, searchParams]);

  useEffect(() => {
    const refreshCurrentWeek = () => {
      if (document.visibilityState === "visible") {
        void loadWeek(selectedDate, { force: true });
      }
    };
    window.addEventListener("focus", refreshCurrentWeek);
    document.addEventListener("visibilitychange", refreshCurrentWeek);
    return () => {
      window.removeEventListener("focus", refreshCurrentWeek);
      document.removeEventListener("visibilitychange", refreshCurrentWeek);
    };
  }, [loadWeek, selectedDate]);

  const itemsByDate = useMemo(() => {
    return visibleItems.reduce<Record<string, SerializedPlanItem[]>>((acc, item) => {
      if (!acc[item.date]) acc[item.date] = [];
      acc[item.date].push(item);
      return acc;
    }, {});
  }, [visibleItems]);

  const toSelection = (value: string): PlanPersonSelection | null =>
    value.startsWith("adult:") ? { kind: "adult", id: value.slice("adult:".length) } :
    value.startsWith("child:") ? { kind: "child", id: value.slice("child:".length) } : null;
  const selection = {
    include: includedPeople.map(toSelection).filter((p): p is PlanPersonSelection => p !== null),
    exclude: excludedPeople.map(toSelection).filter((p): p is PlanPersonSelection => p !== null),
    // The «Все доступные / Мои личные / Общие» tabs are hidden for now: do not narrow by a stored value.
    visibility: "ALL" as const,
  };
  // The server returns only records accessible to the current account.
  // The local participant/scope selection can only narrow that set.
  const dayItems = filterVisiblePlanEntries(itemsByDate[selectedDate] ?? [], selection);
  const participantNameById = new Map<string, string>([
    ...familyAdults.map((adult) => [`adult:${adult.id}`, adult.name] as const),
    ...familyChildren.map((child) => [`child:${child.id}`, child.name] as const),
  ]);
  const conflictIds = useMemo(() => findFamilyCalendarConflictIds(dayItems), [dayItems]);
  const todayISO = todayKey();
  const selectedWeekStart = startOfWeek(selectedDate);
  const selectedWeekEnd = addDays(selectedWeekStart, 6);
  const weekItems = filterVisiblePlanEntries(visibleItems, selection)
    .filter((item) => item.date >= selectedWeekStart && item.date <= selectedWeekEnd)
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return (a.effectiveStartsAt ?? a.startsAt ?? "").localeCompare(
        b.effectiveStartsAt ?? b.startsAt ?? "",
      );
    });
  const selectedWeekByDate = weekItems.reduce<Record<string, SerializedPlanItem[]>>((acc, item) => {
    (acc[item.date] ??= []).push(item);
    return acc;
  }, {});
  const nearestWeekItem =
    weekItems.find((item) => item.date >= todayISO) ?? weekItems[0] ?? null;

  const replaceCachedItem = useCallback((saved: SerializedPlanItem) => {
    setItemsByWeek((current) => upsertCalendarWeekItem(current, saved));
    invalidatePlanDayMarkers();
    setScenarioStatuses((current) => scenarioStatusesAfterManualSave(current, editingManualItem, saved));
    selectDate(saved.date);
    toast(itemForCacheMessage(saved), { duration: 2000 });
  }, [editingManualItem, selectDate]);

  const handleRemoveItem = (itemId: string) => {
    const removed = items.find((item) => item.id === itemId);
    if (removed) {
      setScenarioStatuses((current) => scenarioStatusesAfterManualCancel(current, removed));
    }
    invalidatePlanDayMarkers();
    setItemsByWeek((current) => Object.fromEntries(
      Object.entries(current).map(([week, weekItems]) => [week, weekItems.filter((item) => item.id !== itemId)]),
    ));
  };

  const openCreate = () => {
    setNewTaskOpen(true);
  };

  const openEdit = (item: SerializedPlanItem) => {
    setEditingManualItem(item);
    setManualDialogOpen(true);
  };

  const handleVisibilityChange = (
    itemId: string,
    next: { visibility: "PRIVATE" | "FAMILY"; updatedAt: string },
  ) => {
    invalidatePlanDayMarkers();
    setItemsByWeek((current) => Object.fromEntries(Object.entries(current).map(([week, weekItems]) => [week, weekItems.map((i) => i.id === itemId ? { ...i, ...next } : i)])));
  };

  return (
    <div className="min-h-screen bg-white">
      <PlanProfileCompletionGate />

      <Container className="pt-10 pb-2">
        <header>
          <div className="flex items-center gap-2 font-mono text-[12.5px] font-medium uppercase tracking-[.16em] text-[#C24E22]">
            <i aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#C24E22]" />
            Мой план
            <span className="text-[#6F675E]">{monthName(selectedDate)}</span>
          </div>
          <h1 className="mt-2.5 text-[clamp(36px,4vw,54px)] font-extrabold leading-[1.05] tracking-[-0.035em] text-[#141210]">
            {weekItems.length > 0 ? "Что у нас на неделе?" : "Неделя пока свободна"}
          </h1>
        </header>
      </Container>

      {/* Week Calendar */}
      <Container className="pt-6 pb-2">
        <PlanCalendar value={selectedDate} onChange={selectDate} variant="page" markerScope="all" />
        {loadingWeek != null ? <span role="status" className="mt-2 block text-xs text-neutral-500">Загрузка…</span> : null}
        <PlanPersonFilter
          className="mt-3"
          options={planPersonFilterOptions([
            ...familyAdults.map((adult) => ({ value: `adult:${adult.id}`, label: adult.name, avatarUrl: adult.avatarUrl })),
            ...familyChildren.map((child) => ({ value: `child:${child.id}`, label: child.name })),
          ])}
          selectedValues={includedPeople}
          onAudienceChange={({ include, exclude }) => updateAudienceFilters({ ...audienceFilters, include, exclude })}
          excludedValues={excludedPeople}
        />
      </Container>

      {/* Main: day list + ideas row | check-in, week overview, archive */}
      <Container className="pt-6 pb-8">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <PlanDayList
              date={selectedDate}
              items={dayItems}
              participantNameById={participantNameById}
              onRemove={handleRemoveItem}
              familyView={familyUi ? familyView : null}
              onVisibilityChange={handleVisibilityChange}
              onEditManual={openEdit}
              conflictIds={conflictIds}
              scenarioStatus={scenarioStatuses[selectedDate]}
            />
            <IdeasRow count={initialIdeas.length} />
          </div>

          <aside className="flex min-w-0 flex-col gap-3.5 lg:sticky lg:top-6">
            {/* Explicit post-event check-in; never opened as an automatic modal. */}
            <ExperienceCheckIn
              candidates={experienceCandidates}
              recentExperiences={recentExperiences}
            />
            <div className="overflow-hidden rounded-[22px] border border-[#ECE6DD] bg-[#F8F5EF]">
              <button
                type="button"
                onClick={() => weekItems.length > 0 && setOverviewOpen(true)}
                disabled={weekItems.length === 0}
                aria-label={weekItems.length > 0 ? "Открыть обзор недели" : "На этой неделе план пока пуст"}
                className="flex w-full flex-col gap-2 px-[22px] py-5 text-left transition-colors enabled:hover:bg-white/60 disabled:cursor-default"
              >
                <span className="font-mono text-[11.5px] uppercase tracking-[.14em] text-[#6F675E]">
                  На этой неделе
                </span>
                <span className="font-sans text-[27px] font-normal leading-tight text-[#141210]">
                  {weekItems.length === 0 ? "Нет событий" : `${weekItems.length} ${pluralizeEvents(weekItems.length)}`}
                </span>
                {weekItems.length > 0 && (
                  <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#C24E22]">
                    Посмотреть все <span aria-hidden="true">→</span>
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-controls="past-plan-history"
                aria-expanded={archiveOpen}
                onClick={() => {
                  setArchiveOpen(true);
                  window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                      document.getElementById("past-plan-history")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    });
                  });
                }}
                className="flex min-h-11 w-full items-center justify-between border-t border-[#ECE6DD] px-[22px] py-2 text-left text-sm font-medium text-[#6F675E] transition-colors hover:bg-white/60 hover:text-[#141210]"
              >
                Архив событий <span aria-hidden="true">→</span>
              </button>
            </div>
          </aside>
        </div>
      </Container>

      {archiveOpen && (
        <Container>
          <PastPlanArchive
            entries={pastEntries}
            hasNext={pastEntriesHasNext}
            page={pastEntriesPage}
            selectedDate={selectedDate}
            onClose={() => setArchiveOpen(false)}
          />
        </Container>
      )}

      <PlanOverviewDialog
        open={overviewOpen}
        onOpenChange={setOverviewOpen}
        itemsByDate={selectedWeekByDate}
        totalItems={weekItems.length}
        totalDays={Object.keys(selectedWeekByDate).length}
        onRemove={handleRemoveItem}
        familyView={familyUi ? familyView : null}
        onVisibilityChange={handleVisibilityChange}
        onOpenDay={(date) => {
          selectDate(date);
          setOverviewOpen(false);
        }}
      />

      {/* Та же стеклянная кнопка «Что нужно сделать?», что и в виджете «Мой план». Не показываем под открытым диалогом. */}
      <div aria-hidden className="h-28" />
      {!newTaskOpen && !manualDialogOpen ? <PlanStickyCounter floating onAdd={openCreate} /> : null}

      <PlanNewTaskDialog
        open={newTaskOpen}
        onOpenChange={setNewTaskOpen}
        date={selectedDate}
        familyChildren={familyChildren}
        onSaved={(date) => {
          setNewTaskOpen(false);
          invalidatePlanDayMarkers();
          selectDate(date);
        }}
      />

      <ManualPlanEntryDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        date={selectedDate}
        familyChildren={familyChildren}
        item={editingManualItem}
        currentUserId={currentUserId}
        onSaved={replaceCachedItem}
        onConflict={() => {
          setManualDialogOpen(false);
          setEditingManualItem(null);
          toast.error("Запись уже изменили. Показываем свежую версию — повторите действие.");
          router.refresh();
        }}
      />

    </div>
  );
}
