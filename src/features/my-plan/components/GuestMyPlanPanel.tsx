"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { cn } from "@/lib/utils";
import { peachPrimaryCtaLinkClassName } from "@/lib/peachPrimaryCtaLink";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { useOptionalCity } from "@/contexts/CityContext";
import { toast } from "@/lib/toast";
import {
  buildGuestMyPlanDraftPayload,
  loadGuestMyPlanDraft,
  persistGuestMyPlanDraft,
  reviveCommittedFromDraft,
  type GuestPlanSlot,
} from "@/lib/my-plan/guestMyPlanDraftStorage";
import { appendMyPlanOpenToHref } from "@/lib/my-plan/myPlanOpenIntent";
import { getOrCreateAnonymousId } from "@/lib/anonymous/clientAnonymousId";
import { RecommendationCard } from "./RecommendationCard";
import { MyPlanHeader } from "./MyPlanHeader";
import type { PlanItemWithActivity } from "../types/event";
import type { MyPlanIdea } from "../hooks/useMyPlan";
import { normalizePlanSuggestions } from "../lib/planSuggestions";
import type { MyPlanGuestPanelPhase } from "./guestMyPlanTypes";

type GuestSlot = GuestPlanSlot;

const SLOT_LABEL: Record<GuestSlot, string> = {
  morning: "Утро",
  afternoon: "День",
  evening: "Вечер",
};

const KID_AGE_GROUPS = AGE_GROUPS.filter((g) => g.value !== "18+");

function formatRemainingGenerationsRu(n: number): string {
  if (n <= 0) return "";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `Осталось ${n} подборок`;
  if (mod10 === 1) return `Остался ${n} подбор`;
  if (mod10 >= 2 && mod10 <= 4) return `Осталось ${n} подбора`;
  return `Осталось ${n} подборок`;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Одна дата в подписи: «5 мая» */
function formatRuGuestDayMonth(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Диапазон сб–вс для «выходные»: «5–6 мая» или через месяц «30 июня – 1 июля» */
function formatRuGuestWeekendRange(saturdayIso: string): string {
  const sundayIso = addDaysIso(saturdayIso, 1);
  const [y0, m0, d0] = saturdayIso.split("-").map(Number);
  const [y1, m1, d1] = sundayIso.split("-").map(Number);
  const dt0 = new Date(y0, (m0 ?? 1) - 1, d0 ?? 1, 12, 0, 0);
  const dt1 = new Date(y1, (m1 ?? 1) - 1, d1 ?? 1, 12, 0, 0);
  const monthLong = (d: Date) =>
    d.toLocaleDateString("ru-RU", { month: "long" });
  if (
    dt0.getMonth() === dt1.getMonth() &&
    dt0.getFullYear() === dt1.getFullYear()
  ) {
    return `${dt0.getDate()}–${dt1.getDate()} ${monthLong(dt0)}`;
  }
  return `${dt0.getDate()} ${monthLong(dt0)} – ${dt1.getDate()} ${monthLong(dt1)}`;
}

function upcomingSaturdayIso(fromIso: string): string {
  const base = new Date(fromIso + "T12:00:00");
  const dow = base.getDay();
  const delta = (6 - dow + 7) % 7;
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function slotStartsAt(dateIso: string, slot: GuestSlot): Date {
  const hour = slot === "morning" ? 10 : slot === "afternoon" ? 14 : 18;
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hour, 0, 0);
}

function activityToPlanItem(
  dateIso: string,
  slot: GuestSlot,
  activity: NonNullable<MyPlanIdea["activity"]>,
): PlanItemWithActivity {
  return {
    /** Стабильный id по слоту и дате — чтобы карточка после «В план» не считалась новым элементом */
    id: `guest-${activity.id}-${slot}-${dateIso}`,
    userId: "guest",
    activityId: activity.id,
    date: dateIso,
    startsAt: slotStartsAt(dateIso, slot),
    title: activity.title,
    coverImageUrl: activity.coverImageUrl ?? null,
    createdAt: new Date(),
    activity,
  };
}

function distributeActivitiesToSlots(
  activities: NonNullable<MyPlanIdea["activity"]>[],
): Array<{ slot: GuestSlot; activity: NonNullable<MyPlanIdea["activity"]> }> {
  const slots: GuestSlot[] =
    activities.length >= 3
      ? ["morning", "afternoon", "evening"]
      : ["morning", "afternoon"];
  const useSlots = slots.slice(0, Math.min(slots.length, activities.length));
  return useSlots.map((slot, i) => ({
    slot,
    activity: activities[i],
  }));
}

interface GuestMyPlanPanelProps {
  layout?: "default" | "desktop";
  onRequestClose: () => void;
  setSelectedPlanDate: (iso: string) => void;
  todayIso: string;
}

export function GuestMyPlanPanel({
  layout = "default",
  onRequestClose,
  setSelectedPlanDate,
  todayIso,
}: GuestMyPlanPanelProps) {
  const pathname = usePathname();
  const cityCtx = useOptionalCity();
  const citySlug = cityCtx?.citySlug ?? "minsk";
  const isDesktop = layout === "desktop";

  const [phase, setPhase] = useState<MyPlanGuestPanelPhase>(() => "empty");
  const [authGateVisible, setAuthGateVisible] = useState(false);

  const [freeSearch, setFreeSearch] = useState(false);
  const [goAdult, setGoAdult] = useState(true);
  const [kidRanges, setKidRanges] = useState<string[]>([]);

  const [whenChoice, setWhenChoice] = useState<"today" | "tomorrow" | "weekend">(
    "today",
  );
  const [formatChoice, setFormatChoice] = useState<"calm" | "active" | "any">(
    "any",
  );

  const [scenarioSlots, setScenarioSlots] = useState<
    Array<{ slot: GuestSlot; activity: NonNullable<MyPlanIdea["activity"]> }>
  >([]);
  const [committedBySlot, setCommittedBySlot] = useState<
    Partial<Record<GuestSlot, PlanItemWithActivity>>
  >({});
  const [loadingScenario, setLoadingScenario] = useState(false);
  /** Для сохранения черновика и триггера auth gate после «ещё вариантов» */
  const [engagementActionCount, setEngagementActionCount] = useState(0);
  /** Не даём отправить второй POST до завершения первого (иначе быстро расходуется rate limit). */
  const scenarioGenerationInFlightRef = useRef(false);

  /** Остаток подборок с сервера (null — ещё не было успешного ответа) */
  const [guestRemainingGenerations, setGuestRemainingGenerations] = useState<
    number | null
  >(null);
  /** Лимит исчерпан по учёту на сервере */
  const [guestQuotaBlocked, setGuestQuotaBlocked] = useState(false);

  const scenarioSlotsRef = useRef(scenarioSlots);
  scenarioSlotsRef.current = scenarioSlots;
  const committedRef = useRef(committedBySlot);
  committedRef.current = committedBySlot;
  const restoreDoneRef = useRef(false);

  const resolvedTargetDate = useMemo(() => {
    if (whenChoice === "today") return todayIso;
    if (whenChoice === "tomorrow") return addDaysIso(todayIso, 1);
    return upcomingSaturdayIso(todayIso);
  }, [todayIso, whenChoice]);

  const generatedPlanHeading = useMemo(() => {
    if (whenChoice === "today") {
      return "Вот что мы подобрали для вас на сегодня";
    }
    if (whenChoice === "tomorrow") {
      return "Вот что мы подобрали для вас на завтра";
    }
    return "Вот что мы подобрали для вас на выходные";
  }, [whenChoice]);

  const generatedPlanDateLine = useMemo(() => {
    if (whenChoice === "weekend") {
      return formatRuGuestWeekendRange(resolvedTargetDate);
    }
    return formatRuGuestDayMonth(resolvedTargetDate);
  }, [whenChoice, resolvedTargetDate]);

  useLayoutEffect(() => {
    const anon = getOrCreateAnonymousId();
    if (!anon) {
      restoreDoneRef.current = true;
      return;
    }
    const draft = loadGuestMyPlanDraft(anon, citySlug);
    if (!draft) {
      setPhase("empty");
      setAuthGateVisible(false);
      setEngagementActionCount(0);
      setFreeSearch(false);
      setGoAdult(true);
      setKidRanges([]);
      setWhenChoice("today");
      setFormatChoice("any");
      setScenarioSlots([]);
      setCommittedBySlot({});
      setGuestRemainingGenerations(null);
      setGuestQuotaBlocked(false);
      setSelectedPlanDate(todayIso);
      restoreDoneRef.current = true;
      return;
    }
    setPhase(draft.phase);
    setAuthGateVisible(draft.authGateVisible);
    setEngagementActionCount(draft.engagementActionCount);
    setFreeSearch(draft.freeSearch);
    setGoAdult(draft.goAdult);
    setKidRanges(draft.kidRanges);
    setWhenChoice(draft.whenChoice);
    setFormatChoice(draft.formatChoice);
    setScenarioSlots(draft.scenarioSlots);
    setCommittedBySlot(reviveCommittedFromDraft(draft));
    setGuestRemainingGenerations(draft.guestRemainingGenerations);
    setGuestQuotaBlocked(draft.guestQuotaBlocked);
    if (draft.selectedPlanDateIso) {
      setSelectedPlanDate(draft.selectedPlanDateIso);
    }
    restoreDoneRef.current = true;
  }, [citySlug, setSelectedPlanDate]);

  useEffect(() => {
    if (!restoreDoneRef.current) return;
    const anon = getOrCreateAnonymousId();
    if (!anon) return;
    const meaningful =
      phase !== "empty" ||
      scenarioSlots.length > 0 ||
      Object.keys(committedBySlot).length > 0;
    if (!meaningful) return;

    persistGuestMyPlanDraft(
      buildGuestMyPlanDraftPayload({
        anonymousId: anon,
        citySlug,
        phase,
        authGateVisible,
        engagementActionCount,
        freeSearch,
        goAdult,
        kidRanges,
        whenChoice,
        formatChoice,
        scenarioSlots,
        committedBySlot,
        guestRemainingGenerations,
        guestQuotaBlocked,
        selectedPlanDateIso: resolvedTargetDate,
      }),
    );
  }, [
    phase,
    authGateVisible,
    engagementActionCount,
    freeSearch,
    goAdult,
    kidRanges,
    whenChoice,
    formatChoice,
    scenarioSlots,
    committedBySlot,
    guestRemainingGenerations,
    guestQuotaBlocked,
    resolvedTargetDate,
    citySlug,
  ]);

  const guestCanGenerateMore =
    !guestQuotaBlocked &&
    (guestRemainingGenerations === null || guestRemainingGenerations > 0);

  const recordEngagement = useCallback(() => {
    setEngagementActionCount((prev) => {
      const next = prev + 1;
      if (next >= 2) setAuthGateVisible(true);
      return next;
    });
  }, []);

  const fetchScenario = useCallback(
    async (opts?: { showGeneratedShellFirst?: boolean }) => {
      if (!guestCanGenerateMore) {
        toast.error(
          "Бесплатные подборки закончились — войдите или зарегистрируйтесь",
        );
        return;
      }
      if (scenarioGenerationInFlightRef.current) {
        return;
      }
      scenarioGenerationInFlightRef.current = true;
      if (opts?.showGeneratedShellFirst) {
        setPhase((p) => (p === "engaged" ? "engaged" : "generated"));
      }
      setLoadingScenario(true);
      try {
        const exclude: string[] = [];
        for (const row of scenarioSlotsRef.current)
          exclude.push(row.activity.id);
        for (const item of Object.values(committedRef.current)) {
          if (item?.activityId) exclude.push(item.activityId);
        }

        const anonymousId = getOrCreateAnonymousId();

        const res = await fetch("/api/plan/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anonymousId: anonymousId || undefined,
            city: citySlug,
            date: resolvedTargetDate,
            exclude,
            ageRanges: kidRanges.slice().sort(),
          }),
        });

        if (res.status === 429) {
          toast.error("Слишком частые запросы. Подождите минуту.");
          return;
        }

        if (res.status === 503) {
          toast.error("Сервис перегружен. Попробуйте ещё раз.");
          return;
        }

        const data = (await res.json()) as {
          suggestions?: NonNullable<MyPlanIdea["activity"]>[];
          requiresAuth?: boolean;
          remainingGenerations?: number;
        };

        if (!res.ok) {
          toast.error("Не удалось собрать подборку");
          setPhase((p) => {
            if (p !== "generated") return p;
            return scenarioSlotsRef.current.length === 0 ? "onboarding" : p;
          });
          return;
        }

        if (data.requiresAuth) {
          setGuestQuotaBlocked(true);
          setGuestRemainingGenerations(0);
          return;
        }

        setGuestQuotaBlocked(false);
        if (typeof data.remainingGenerations === "number") {
          setGuestRemainingGenerations(data.remainingGenerations);
        }

        const raw = Array.isArray(data.suggestions) ? data.suggestions : [];
        let merged = normalizePlanSuggestions(raw, 6);
        if (formatChoice === "active") merged = [...merged].reverse();
        const distributed = distributeActivitiesToSlots(merged.slice(0, 6));

        setScenarioSlots(distributed);
        setSelectedPlanDate(resolvedTargetDate);
        setPhase((p) => (p === "engaged" ? "engaged" : "generated"));
      } catch {
        toast.error("Не удалось собрать подборку");
        setPhase((p) => {
          if (p !== "generated") return p;
          return scenarioSlotsRef.current.length === 0 ? "onboarding" : p;
        });
      } finally {
        scenarioGenerationInFlightRef.current = false;
        setLoadingScenario(false);
      }
    },
    [
      citySlug,
      formatChoice,
      guestCanGenerateMore,
      kidRanges,
      resolvedTargetDate,
      setSelectedPlanDate,
    ],
  );

  const handleRegenerate = useCallback(() => {
    recordEngagement();
    void fetchScenario();
  }, [fetchScenario, recordEngagement]);

  const handleAddScenarioToPlan = useCallback(
    async (slot: GuestSlot, activity: NonNullable<MyPlanIdea["activity"]>) => {
      const item = activityToPlanItem(resolvedTargetDate, slot, activity);
      setCommittedBySlot((prev) => ({ ...prev, [slot]: item }));
      setScenarioSlots((rows) => rows.filter((r) => r.slot !== slot));
      toast.success(`Добавлено в ${SLOT_LABEL[slot]}`);
      setPhase("engaged");
      recordEngagement();
    },
    [recordEngagement, resolvedTargetDate],
  );

  const handleRemoveCommitted = useCallback((slot: GuestSlot) => {
    setCommittedBySlot((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }, []);

  useEffect(() => {
    if (phase !== "engaged") return;
    if (Object.keys(committedBySlot).length > 0) return;
    setPhase("generated");
  }, [committedBySlot, phase]);

  const nextAuthHref = appendMyPlanOpenToHref(pathname || "/");
  const loginHref = `/login?next=${encodeURIComponent(nextAuthHref)}`;
  const registerHref = `/register?next=${encodeURIComponent(nextAuthHref)}`;

  const whoChips = useMemo(
    (): ChipItem[] => [
      {
        id: "adult",
        label: "Я",
        active: !freeSearch && goAdult,
        onClick: () => {
          setFreeSearch(false);
          setGoAdult(true);
          setKidRanges([]);
        },
      },
      {
        id: "kids",
        label: "Дети",
        active: !freeSearch && !goAdult,
        onClick: () => {
          setFreeSearch(false);
          setGoAdult(false);
        },
      },
      {
        id: "free",
        label: "Свободный поиск",
        active: freeSearch,
        onClick: () => {
          setFreeSearch(true);
          setGoAdult(false);
          setKidRanges([]);
        },
      },
    ],
    [freeSearch, goAdult],
  );

  const kidAgeChips = useMemo(
    (): ChipItem[] =>
      KID_AGE_GROUPS.map((g) => ({
        id: g.value,
        label: g.label,
        active: kidRanges.includes(g.value),
        onClick: () => {
          setKidRanges((prev) =>
            prev.includes(g.value)
              ? prev.filter((x) => x !== g.value)
              : [...prev, g.value],
          );
        },
      })),
    [kidRanges],
  );

  const whenChips = useMemo(
    (): ChipItem[] =>
      (
        [
          ["today", "Сегодня"],
          ["tomorrow", "Завтра"],
          ["weekend", "Выходные"],
        ] as const
      ).map(([key, label]) => ({
        id: key,
        label,
        active: whenChoice === key,
        onClick: () => setWhenChoice(key),
      })),
    [whenChoice],
  );

  const formatChips = useMemo(
    (): ChipItem[] =>
      (
        [
          ["calm", "Спокойно"],
          ["active", "Активно"],
          ["any", "Не важно"],
        ] as const
      ).map(([key, label]) => ({
        id: key,
        label,
        active: formatChoice === key,
        onClick: () => setFormatChoice(key),
      })),
    [formatChoice],
  );

  const renderAuthGate = () =>
    authGateVisible ? (
      <section className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-neutral-900">
            Сохранить в «Мой план»?
          </p>
          <p className="text-sm leading-relaxed text-neutral-600">
            Сохраним ваш день, участников и предпочтения — чтобы не потерять
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild className="rounded-full" variant="default">
              <Link href={loginHref}>Войти</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href={registerHref}>Регистрация</Link>
            </Button>
          </div>
        </div>
      </section>
    ) : null;

  const renderScenarioBlocks = (opts: { showRegenerateCta: boolean }) => {
    return (
    <div className="space-y-4">
      {(["morning", "afternoon", "evening"] as const).map((slotKey) => {
        const row = scenarioSlots.find((s) => s.slot === slotKey);
        if (!row) return null;
        const item = activityToPlanItem(
          resolvedTargetDate,
          row.slot,
          row.activity,
        );
        return (
          <section key={`${slotKey}-${row.activity.id}`} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {SLOT_LABEL[slotKey]}
            </p>
            <RecommendationCard
              item={item}
              onAddToPlan={() =>
                void handleAddScenarioToPlan(row.slot, row.activity)
              }
            />
          </section>
        );
      })}

      {opts.showRegenerateCta ? (
        <div className="space-y-1.5">
          {guestQuotaBlocked || guestRemainingGenerations === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 shadow-sm">
              <p className="text-center text-sm font-medium text-neutral-900">
                Сохраним ваш план и подберём ещё
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button asChild className="rounded-full" variant="default">
                  <Link href={loginHref}>Войти</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href={registerHref}>Регистрация</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={cn(
                  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#EF8759] bg-white px-5 text-sm font-semibold text-[#EF8759] transition-all hover:bg-[#FFF8F5] active:scale-[0.97]",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
                onClick={handleRegenerate}
                disabled={loadingScenario || !guestCanGenerateMore}
              >
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                Ещё варианты
              </button>
              {guestRemainingGenerations != null &&
              guestRemainingGenerations > 0 ? (
                <p className="text-center text-xs text-neutral-600">
                  {formatRemainingGenerationsRu(guestRemainingGenerations)}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
    );
  };

  const renderGenerated = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-neutral-900">
          {generatedPlanHeading}
        </h3>
        <p className="mt-1 text-sm text-neutral-500">{generatedPlanDateLine}</p>
        {loadingScenario && scenarioSlots.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Подбираем варианты…</p>
        ) : null}
      </div>

      {loadingScenario && scenarioSlots.length === 0 ? (
        <div className="space-y-4 py-1">
          {(["morning", "afternoon", "evening"] as const).map((slotKey) => (
            <div key={slotKey} className="space-y-2">
              <div className="h-3 w-14 animate-pulse rounded bg-neutral-200" />
              <div className="h-[148px] animate-pulse rounded-[24px] bg-neutral-100 sm:h-[156px]" />
            </div>
          ))}
        </div>
      ) : (
        renderScenarioBlocks({ showRegenerateCta: true })
      )}
      {renderAuthGate()}
    </div>
  );

  const renderEngaged = () => {
    const slotsOrder: GuestSlot[] = ["morning", "afternoon", "evening"];
    const committedCount = slotsOrder.filter(
      (sk) => committedBySlot[sk]?.activity,
    ).length;
    const planStatusHeadline =
      committedCount >= 2
        ? "🎯 Ваш план готов!"
        : "🎯 Ваш план почти готов!";
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-neutral-900">
            {planStatusHeadline}
          </h3>
        </div>

        {guestQuotaBlocked || guestRemainingGenerations === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 text-center shadow-sm">
            <p className="text-sm font-medium text-neutral-900">
              Сохраним ваш план и подберём ещё
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button asChild className="rounded-full" variant="default">
                <Link href={loginHref}>Войти</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href={registerHref}>Регистрация</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {slotsOrder.map((sk) => {
          const item = committedBySlot[sk];
          if (!item?.activity) return null;
          return (
            <section key={`committed-${sk}`} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                {SLOT_LABEL[sk]}
              </p>
              <RecommendationCard
                item={item}
                isInPlan
                onRemoveFromPlan={() => handleRemoveCommitted(sk)}
              />
            </section>
          );
        })}

        {scenarioSlots.length > 0 ? (
          <div className="space-y-3 border-t border-neutral-100 pt-4">
            <p className="text-sm font-semibold text-neutral-800">
              Ещё идеи на этот день
            </p>
            {renderScenarioBlocks({ showRegenerateCta: false })}
          </div>
        ) : null}

        {renderAuthGate()}
      </div>
    );
  };

  const body = (() => {
    switch (phase) {
      case "empty":
        return (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-neutral-900">
                Соберём план на сегодня за 10 секунд
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                Подберём активности под вас и вашего ребенка
              </p>
            </div>
            <button
              type="button"
              className={peachPrimaryCtaLinkClassName(
                "touch-manipulation self-center sm:min-w-[240px]",
              )}
              onClick={() => setPhase("onboarding")}
            >
              Реши за меня
              <ArrowRight
                className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 sm:h-[18px] sm:w-[18px]"
                aria-hidden
              />
            </button>
          </div>
        );
      case "onboarding":
        return (
          <div className="space-y-5 text-center">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Кто идёт
              </p>
              <ChipsRow
                layout="masonry"
                justifyWrap="center"
                aria-label="Кто идёт"
                items={whoChips}
              />
              {!freeSearch && !goAdult ? (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-muted-foreground">Возраст</p>
                  <ChipsRow
                    layout="masonry"
                    justifyWrap="center"
                    aria-label="Возраст ребёнка"
                    items={kidAgeChips}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Когда
              </p>
              <ChipsRow
                layout="masonry"
                justifyWrap="center"
                aria-label="Когда"
                items={whenChips}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Формат
              </p>
              <ChipsRow
                layout="masonry"
                justifyWrap="center"
                aria-label="Формат"
                items={formatChips}
              />
            </div>

            <div className="flex justify-center pt-1">
              {guestQuotaBlocked || guestRemainingGenerations === 0 ? (
                <div className="max-w-md rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 text-center shadow-sm">
                  <p className="text-sm font-medium text-neutral-900">
                    Сохраним ваш план и подберём ещё
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Button asChild className="rounded-full" variant="default">
                      <Link href={loginHref}>Войти</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full">
                      <Link href={registerHref}>Регистрация</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={loadingScenario || !guestCanGenerateMore}
                  className={peachPrimaryCtaLinkClassName(
                    cn(
                      "touch-manipulation self-center sm:min-w-[240px]",
                      (loadingScenario || !guestCanGenerateMore) &&
                        "pointer-events-none opacity-50",
                    ),
                  )}
                  onClick={() =>
                    void fetchScenario({ showGeneratedShellFirst: true })
                  }
                >
                  Найди варианты
                  <ArrowRight
                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1 sm:h-[18px] sm:w-[18px]"
                    aria-hidden
                  />
                </button>
              )}
            </div>
          </div>
        );
      case "generated":
        return renderGenerated();
      case "engaged":
        return renderEngaged();
      default:
        return null;
    }
  })();

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FFFDFC]">
      <div
        className={cn(
          "flex-shrink-0 bg-[#FFFDFC]",
          isDesktop
            ? "sticky top-0 z-20 px-8 pb-3 pt-6"
            : "border-b border-neutral-200 bg-white/90 px-4 pb-3 pt-6 backdrop-blur supports-[backdrop-filter]:bg-white/85",
        )}
      >
        <MyPlanHeader onClose={onRequestClose} compact={!isDesktop} />
      </div>

      <div
        className={cn(
          "flex-1 overflow-y-auto bg-[#FFFDFC]",
          isDesktop
            ? "space-y-4 px-8 pb-6 pt-2"
            : "space-y-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4",
        )}
      >
        {body}
      </div>
    </div>
  );
}
