"use client";

import React from "react";
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
import { ArrowRight, Bell, Info, Infinity as InfinityIcon, Monitor, Repeat2, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { buildAuthUrl } from "@/lib/auth/redirectTo";
import { getOrCreateAnonymousId } from "@/lib/anonymous/clientAnonymousId";
import { RecommendationCard } from "./RecommendationCard";
import { MyPlanHeader } from "./MyPlanHeader";
import { PlanScreenHead } from "./v3/PlanScreenHead";
import type { PlanItemWithActivity } from "../types/event";
import type { MyPlanIdea } from "../hooks/useMyPlan";
import { normalizePlanSuggestions } from "../lib/planSuggestions";
import type { MyPlanGuestPanelPhase } from "./guestMyPlanTypes";

type GuestSlot = GuestPlanSlot;

const KID_AGE_GROUPS = AGE_GROUPS.filter((g) => g.value !== "18+");

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
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
  /** «Подборки закончились» и шторка входа при «Сохранить план». */
  const [showOut, setShowOut] = useState(false);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [refetchForWeekend, setRefetchForWeekend] = useState(false);

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
      // Карточка остаётся в выдаче («В плане»); если слот уже занят другим событием — берём свободный, чтобы ничего не затереть.
      const order: GuestSlot[] = ["morning", "afternoon", "evening"];
      const target = committedRef.current[slot]
        ? (order.find((sk) => !committedRef.current[sk]) ?? slot)
        : slot;
      const item = activityToPlanItem(resolvedTargetDate, target, activity);
      setCommittedBySlot((prev) => ({ ...prev, [target]: item }));
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

  /** Auto-fetch when restored to generated phase with no cards (e.g. stale draft) */
  useEffect(() => {
    if (!restoreDoneRef.current) return;
    if (phase !== "generated") return;
    if (scenarioSlots.length > 0) return;
    if (loadingScenario) return;
    if (!guestCanGenerateMore) return;
    void fetchScenario();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, guestCanGenerateMore]);

  const nextAuthHref = appendMyPlanOpenToHref(pathname || "/");
  const loginHref = buildAuthUrl({ redirectTo: nextAuthHref });
  const registerHref = buildAuthUrl({ mode: "register", redirectTo: nextAuthHref });

  const slotsOrder: GuestSlot[] = ["morning", "afternoon", "evening"];
  const committedList = slotsOrder
    .map((sk) => ({ sk, item: committedBySlot[sk] }))
    .filter((x): x is { sk: GuestSlot; item: PlanItemWithActivity } => Boolean(x.item?.activity));
  const committedCount = committedList.length;
  const quotaBlocked = guestQuotaBlocked || guestRemainingGenerations === 0;

  /** Экран v3 выводится из сохранённой фазы черновика — формат хранения не менялся. */
  const screen: "quiz" | "results" | "empty" | "draft" | "out" = showOut
    ? "out"
    : phase === "engaged"
      ? "draft"
      : phase === "generated"
        ? scenarioSlots.length === 0 && !loadingScenario
          ? quotaBlocked
            ? "out"
            : "empty"
          : "results"
        : "quiz";

  const shortDay = (iso: string) =>
    new Date(`${iso}T12:00:00`)
      .toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" })
      .replace(/\./g, "");
  const WHEN_OPTIONS: Array<{ key: "today" | "tomorrow" | "weekend"; label: string; sub: string }> = [
    { key: "today", label: "Сегодня", sub: shortDay(todayIso) },
    { key: "tomorrow", label: "Завтра", sub: shortDay(addDaysIso(todayIso, 1)) },
    {
      key: "weekend",
      label: "Выходные",
      sub: (() => {
        const sat = upcomingSaturdayIso(todayIso);
        const [, m0, d0] = sat.split("-").map(Number);
        const [, m1, d1] = addDaysIso(sat, 1).split("-").map(Number);
        return m0 === m1 ? `сб–вс, ${d0}–${d1}` : `сб–вс`;
      })(),
    },
  ];
  const WHO_OPTIONS: Array<{ key: "kids" | "me" | "any"; label: string }> = [
    { key: "kids", label: "С детьми" },
    { key: "me", label: "Для себя" },
    { key: "any", label: "Без разницы" },
  ];
  const whoKey: "kids" | "me" | "any" = freeSearch ? "any" : goAdult ? "me" : "kids";
  const pickWho = (key: "kids" | "me" | "any") => {
    setFreeSearch(key === "any");
    setGoAdult(key === "me");
    if (key !== "kids") setKidRanges([]);
  };
  const MOOD_OPTIONS: Array<{ key: "calm" | "active" | "any"; label: string }> = [
    { key: "calm", label: "Спокойно" },
    { key: "active", label: "Активно" },
    { key: "any", label: "Без разницы" },
  ];
  const MOOD_TEXT = { calm: "спокойно", active: "активно", any: "любое настроение" } as const;
  const summaryText = (() => {
    const who =
      whoKey === "kids"
        ? `С детьми ${KID_AGE_GROUPS.filter((g) => kidRanges.includes(g.value)).map((g) => g.label).join(", ")}`.trim()
        : whoKey === "me"
          ? "Для себя"
          : "С кем угодно";
    const w = WHEN_OPTIONS.find((o) => o.key === whenChoice)!;
    return `${who} · ${w.label}, ${w.sub} · ${MOOD_TEXT[formatChoice]}`;
  })();
  const quizValid = !(whoKey === "kids" && kidRanges.length === 0);

  useEffect(() => {
    if (!refetchForWeekend || whenChoice !== "weekend") return;
    setRefetchForWeekend(false);
    void fetchScenario({ showGeneratedShellFirst: true });
  }, [refetchForWeekend, whenChoice, fetchScenario]);

  const runQuiz = () => {
    if (!guestCanGenerateMore) {
      setShowOut(true);
      return;
    }
    void fetchScenario({ showGeneratedShellFirst: true });
  };

  const chipClass = (on: boolean) =>
    cn(
      "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold transition-colors",
      on
        ? "border-[var(--mp-tx)] bg-[var(--mp-tx)] text-white"
        : "border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-tx)] hover:border-[var(--mp-line-strong)]",
    );
  const primaryBtn =
    "flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--mp-ac)] text-base font-bold text-white transition-colors hover:bg-[var(--mp-ac-dark)] disabled:bg-[#E6E0D9] disabled:text-[#6F6A65]";
  const quietBtn =
    "flex min-h-11 w-full items-center justify-center gap-[7px] rounded-xl text-[15px] font-bold text-[var(--mp-tx2)] transition-colors hover:text-[var(--mp-tx)]";

  const benefit = (icon: React.ReactNode, text: React.ReactNode) => (
    <div className="flex items-center gap-[13px] py-2 text-[15px] font-semibold leading-[1.35] text-[var(--mp-tx)]">
      <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] border border-[var(--mp-line)] bg-[var(--mp-card)] text-[var(--mp-ac)]">
        {icon}
      </span>
      {text}
    </div>
  );

  const resultCards = scenarioSlots.map((row) => {
    const committed = committedList.find((c) => c.item.activityId === row.activity.id);
    const item = committed?.item ?? activityToPlanItem(resolvedTargetDate, row.slot, row.activity);
    return (
      <RecommendationCard
        key={`${row.slot}-${row.activity.id}`}
        item={item}
        isInPlan={Boolean(committed)}
        onAddToPlan={() => void handleAddScenarioToPlan(row.slot, row.activity)}
        onRemoveFromPlan={() => committed && handleRemoveCommitted(committed.sk)}
      />
    );
  });

  let head: React.ReactNode;
  let body: React.ReactNode;
  let footer: React.ReactNode = null;

  if (screen === "quiz") {
    head = <MyPlanHeader onClose={onRequestClose} compact={!isDesktop} />;
    body = (
      <>
        <p className="mb-[22px] text-[15px] leading-[1.5] text-[var(--mp-tx2)]">
          Подберём, куда сходить. Три вопроса — и&nbsp;покажем варианты из&nbsp;афиши.
        </p>
        <div className="mb-[26px]">
          <div className="mb-[11px] text-[17px] font-bold tracking-[-.01em] text-[var(--mp-tx)]">С кем идёте?</div>
          <div className="flex flex-wrap gap-2">
            {WHO_OPTIONS.map((o) => (
              <button key={o.key} type="button" aria-pressed={whoKey === o.key} onClick={() => pickWho(o.key)} className={chipClass(whoKey === o.key)}>
                {o.label}
              </button>
            ))}
          </div>
          {whoKey === "kids" ? (
            <div className="mt-3 rounded-2xl bg-[var(--mp-soft)] p-3">
              <span className="mb-[9px] block text-[13px] font-medium text-[var(--mp-tx2)]">Возраст детей — можно несколько</span>
              <div className="flex flex-wrap gap-2">
                {KID_AGE_GROUPS.map((g) => {
                  const on = kidRanges.includes(g.value);
                  return (
                    <button
                      key={g.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setKidRanges((prev) => (on ? prev.filter((x) => x !== g.value) : [...prev, g.value]))}
                      className={chipClass(on)}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        <div className="mb-[26px]">
          <div className="mb-[11px] text-[17px] font-bold tracking-[-.01em] text-[var(--mp-tx)]">Когда?</div>
          <div className="grid grid-cols-3 gap-2">
            {WHEN_OPTIONS.map((o) => {
              const on = whenChoice === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setWhenChoice(o.key)}
                  className={cn(
                    "flex min-h-[66px] flex-col items-start justify-center rounded-2xl border px-3 py-2.5 text-left transition-colors",
                    on ? "border-[var(--mp-tx)] bg-[var(--mp-tx)] text-white" : "border-[var(--mp-line)] bg-[var(--mp-card)] hover:border-[var(--mp-line-strong)]",
                  )}
                >
                  <b className="text-[15px] font-bold">{o.label}</b>
                  <span className={cn("mt-0.5 text-[12.5px]", on ? "text-white/80" : "text-[var(--mp-tx2)]")}>{o.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-[11px] text-[17px] font-bold tracking-[-.01em] text-[var(--mp-tx)]">Какое настроение?</div>
          <div className="flex flex-wrap gap-2">
            {MOOD_OPTIONS.map((o) => (
              <button key={o.key} type="button" aria-pressed={formatChoice === o.key} onClick={() => setFormatChoice(o.key)} className={chipClass(formatChoice === o.key)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </>
    );
    footer = (
      <>
        <button type="button" className={primaryBtn} disabled={!quizValid || loadingScenario} onClick={runQuiz}>
          {loadingScenario ? "Подбираем…" : "Показать варианты"}
        </button>
        {guestRemainingGenerations === 1 ? (
          <p className="mt-2.5 text-center text-[13.5px] text-[var(--mp-tx2)]">Осталась последняя бесплатная подборка</p>
        ) : null}
      </>
    );
  } else if (screen === "results") {
    const isLoadingEmpty = loadingScenario && scenarioSlots.length === 0;
    head = <MyPlanHeader onClose={onRequestClose} compact={!isDesktop} />;
    body = (
      <>
        <div className="mb-[18px] flex items-center gap-2 rounded-[14px] border border-[var(--mp-line)] bg-[var(--mp-card)] py-2 pl-3.5 pr-1">
          <span className="flex-1 text-[13.5px] leading-[1.4] text-[var(--mp-tx2)]">{summaryText}</span>
          <button type="button" onClick={() => setPhase("onboarding")} className="min-h-11 rounded-xl px-3 text-sm font-bold text-[var(--mp-ac-dark)]">
            Изменить
          </button>
        </div>
        {isLoadingEmpty ? (
          <div className="space-y-2.5" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[136px] animate-pulse rounded-[18px] border border-[var(--mp-line)] bg-[var(--mp-card)]" />
            ))}
          </div>
        ) : (
          <>
            <h3 className="mb-3.5 text-[22px] font-bold leading-[1.2] tracking-[-.02em] text-[var(--mp-tx)]">
              Нашли {scenarioSlots.length} {scenarioSlots.length === 1 ? "вариант" : scenarioSlots.length < 5 ? "варианта" : "вариантов"}
            </h3>
            <div className="space-y-2.5">{resultCards}</div>
            {guestCanGenerateMore ? (
              <button type="button" className={cn(quietBtn, "mt-2")} disabled={loadingScenario} onClick={handleRegenerate}>
                <Repeat2 className="h-[17px] w-[17px]" aria-hidden />
                Показать другие варианты
              </button>
            ) : null}
          </>
        )}
      </>
    );
    if (committedCount > 0) {
      footer = (
        <button type="button" className={primaryBtn} onClick={() => setPhase("engaged")}>
          В плане: {committedCount}
          <span className="opacity-55">·</span>
          Дальше
          <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        </button>
      );
    }
  } else if (screen === "empty") {
    const kind = formatChoice === "active" ? "Активных занятий" : formatChoice === "calm" ? "Спокойных занятий" : "Подходящих событий";
    const whenText = whenChoice === "today" ? "сегодня" : whenChoice === "tomorrow" ? "завтра" : "на выходные";
    const ages = KID_AGE_GROUPS.filter((g) => kidRanges.includes(g.value)).map((g) => g.label);
    head = <PlanScreenHead back="Ответы" onBack={() => setPhase("onboarding")} />;
    body = (
      <div className="px-2 pt-11 text-center">
        <span className="mx-auto mb-[22px] flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[var(--mp-soft)] text-[var(--mp-tx2)]">
          <Search className="h-[30px] w-[30px]" strokeWidth={1.6} aria-hidden />
        </span>
        <h3 className="text-[23px] font-bold leading-[1.2] tracking-[-.02em] text-[var(--mp-tx)]">
          {whenText.charAt(0).toUpperCase() + whenText.slice(1)} подходящего не&nbsp;нашлось
        </h3>
        <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-[1.55] text-[var(--mp-tx2)]">
          {kind}
          {ages.length > 0 ? ` для детей ${ages.join(", ")}` : ""} {whenText} в&nbsp;афише нет. В&nbsp;будни их&nbsp;обычно меньше, чем в&nbsp;выходные.
        </p>
      </div>
    );
    footer = (
      <>
        {whenChoice !== "weekend" ? (
          <button
            type="button"
            className={primaryBtn}
            onClick={() => {
              setWhenChoice("weekend");
              setRefetchForWeekend(true);
            }}
          >
            Посмотреть на выходные
          </button>
        ) : (
          <button type="button" className={primaryBtn} onClick={() => setPhase("onboarding")}>
            Изменить ответы
          </button>
        )}
        {whenChoice !== "weekend" ? (
          <button type="button" className={quietBtn} onClick={() => setPhase("onboarding")}>
            Изменить ответы
          </button>
        ) : null}
      </>
    );
  } else if (screen === "draft") {
    head = <PlanScreenHead back="Варианты" onBack={() => setPhase("generated")} />;
    body = (
      <>
        <h3 className="mb-3.5 text-[22px] font-bold leading-[1.2] tracking-[-.02em] text-[var(--mp-tx)]">Ваш план</h3>
        <div className="mb-4 flex items-start gap-2.5 rounded-[14px] bg-[var(--mp-soft)] px-3.5 py-3 text-[13.5px] leading-[1.45] text-[var(--mp-tx2)]">
          <Info className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden />
          <span>Пока сохранён только в&nbsp;этом браузере. Войдите, чтобы он&nbsp;не&nbsp;потерялся.</span>
        </div>
        {committedList.length === 0 ? (
          <p className="text-[15px] leading-[1.5] text-[var(--mp-tx2)]">Здесь пусто. Вернитесь к&nbsp;вариантам и&nbsp;добавьте то, что нравится.</p>
        ) : (
          committedList.map(({ sk, item }) => (
            <div key={sk} className="mb-2 flex items-center gap-3 rounded-2xl border border-[var(--mp-line)] bg-[var(--mp-card)] py-2.5 pl-3 pr-1.5">
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[15px] font-bold leading-[1.3] tracking-[-.01em] text-[var(--mp-tx)]">
                  {item.title || item.activity?.title}
                </div>
                <div className="mt-0.5 text-[13px] text-[var(--mp-tx2)]">{summaryDateLine(item)}</div>
              </div>
              <button
                type="button"
                aria-label="Убрать"
                onClick={() => handleRemoveCommitted(sk)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--mp-tx2)] transition-colors hover:bg-[var(--mp-soft)] hover:text-[var(--mp-tx)]"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </button>
            </div>
          ))
        )}
      </>
    );
    footer = (
      <button type="button" className={primaryBtn} disabled={committedList.length === 0} onClick={() => setSaveSheetOpen(true)}>
        Сохранить план
      </button>
    );
  } else {
    head = <MyPlanHeader onClose={onRequestClose} compact={!isDesktop} />;
    body = (
      <>
        <div className="mb-2 mt-4 text-[13.5px] font-semibold text-[var(--mp-tx2)]">Вы попробовали 3 подборки — столько доступно без входа</div>
        <h3 className="mb-[22px] text-[30px] font-bold leading-[1.12] tracking-[-.03em] text-[var(--mp-tx)]">
          С&nbsp;аккаунтом подбирать{" "}
          <em className="font-display font-medium text-[var(--mp-ac)]" style={{ fontStyle: "italic" }}>проще</em>
        </h3>
        {benefit(<InfinityIcon className="h-5 w-5" aria-hidden />, "Подборки без ограничений")}
        {benefit(<Users className="h-5 w-5" aria-hidden />, "Точнее — запомним возраст детей")}
        {benefit(<Bell className="h-5 w-5" aria-hidden />, <>Напомним о&nbsp;событиях вовремя</>)}
        {benefit(<Monitor className="h-5 w-5" aria-hidden />, <>Один план для семьи на&nbsp;телефоне и&nbsp;компьютере</>)}
        <div className="mt-[18px] flex items-start gap-2.5 rounded-[14px] bg-[var(--mp-soft)] px-3.5 py-3 text-[13.5px] leading-[1.45] text-[var(--mp-tx2)]">
          <Repeat2 className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden />
          <span>
            {committedCount > 0
              ? `Ваш план (${committedCount} ${committedCount === 1 ? "событие" : committedCount < 5 ? "события" : "событий"}) перенесётся в аккаунт.`
              : "Всё выбранное перенесётся в аккаунт."}
          </span>
        </div>
      </>
    );
    footer = (
      <>
        <Link href={registerHref} className={cn(primaryBtn, "no-underline")}>
          Создать аккаунт бесплатно
        </Link>
        <Link href={loginHref} className={cn(quietBtn, "no-underline")}>
          Уже есть аккаунт?&nbsp;<span className="text-[var(--mp-ac-dark)]">Войти</span>
        </Link>
      </>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--mp-bg)]">
      <div className="flex-shrink-0" style={isDesktop ? { position: "sticky", top: 0, zIndex: 20 } : undefined}>
        {head}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-1 md:px-8">{body}</div>
      {footer ? (
        <div className="shrink-0 border-t border-[var(--mp-line)] bg-[var(--mp-bg)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:px-8">
          {footer}
        </div>
      ) : null}
      {saveSheetOpen ? (
        <div className="absolute inset-0 z-30 flex items-end bg-[rgba(29,27,25,.4)]" onClick={() => setSaveSheetOpen(false)}>
          <div
            role="dialog"
            aria-label="Сохраним ваш план"
            className="w-full rounded-t-3xl bg-[var(--mp-bg)] px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-2"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="mx-auto mb-4 block h-[5px] w-[38px] rounded-full bg-[#D3CBC2]" />
            <h3 className="mb-1.5 text-[23px] font-bold leading-[1.2] tracking-[-.02em] text-[var(--mp-tx)]">Сохраним ваш план</h3>
            <p className="mb-2.5 text-[15px] leading-[1.5] text-[var(--mp-tx2)]">Войдите — и&nbsp;план будет с&nbsp;вами везде.</p>
            {benefit(<Monitor className="h-5 w-5" aria-hidden />, <>Откроется на&nbsp;любом устройстве</>)}
            {benefit(<Bell className="h-5 w-5" aria-hidden />, <>Напомним о&nbsp;событиях вовремя</>)}
            {benefit(<Repeat2 className="h-5 w-5" aria-hidden />, <>Всё выбранное перенесём сами</>)}
            <Link href={loginHref} className={cn(primaryBtn, "mt-4 no-underline")}>
              Войти или создать аккаунт
            </Link>
            <button type="button" className={quietBtn} onClick={() => setSaveSheetOpen(false)}>
              Позже
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function summaryDateLine(item: PlanItemWithActivity): string {
  const src = item.startsAt ?? (item.date ? new Date(`${item.date}T12:00:00`) : null);
  if (!src) return "";
  const d = src instanceof Date ? src : new Date(src);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  return item.activity?.ageLabel ? `${day} · ${item.activity.ageLabel}` : day;
}
