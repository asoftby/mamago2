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
import { buildAuthUrl } from "@/lib/auth/redirectTo";
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
      <div
        style={{
          position: "relative", overflow: "hidden",
          padding: "22px 20px 20px",
          background: "linear-gradient(135deg, #FFE8DC, #FFF1E5)",
          border: "1px solid rgba(232,106,58,.25)",
          borderRadius: 20,
          display: "flex", flexDirection: "column", gap: 12,
        }}
      >
        <span style={{
          position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: 99,
          background: "radial-gradient(circle, rgba(232,106,58,.2), transparent 65%)",
          pointerEvents: "none",
        }}/>
        <h4
          className="font-display"
          style={{
            margin: 0, fontSize: 22, fontWeight: 400, lineHeight: 1.05, letterSpacing: "-.02em",
            color: "#141210", position: "relative", zIndex: 1,
          }}
        >
          Сохраним ваш план<br/>и&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>подберём ещё</em>
        </h4>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#3A332B", position: "relative", zIndex: 1 }}>
          Войдите, чтобы сохранить план и продолжить подбирать варианты.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, position: "relative", zIndex: 1 }}>
          <Link
            href={loginHref}
            style={{
              height: 42, padding: "0 20px", borderRadius: 99,
              background: "linear-gradient(180deg, #FBA77B, #E86A3A)",
              color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 6,
              boxShadow: "0 8px 20px -6px rgba(232,106,58,.45)",
            }}
          >
            Войти →
          </Link>
          <Link
            href={registerHref}
            style={{
              height: 42, padding: "0 16px", borderRadius: 99,
              background: "transparent", color: "#141210",
              border: "1px solid rgba(20,18,16,.18)",
              fontSize: 13, fontWeight: 500, textDecoration: "none",
              display: "inline-flex", alignItems: "center",
            }}
          >
            Регистрация
          </Link>
        </div>
      </div>
    ) : null;

  const renderScenarioBlocks = (opts: { showRegenerateCta: boolean }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {(["morning", "afternoon", "evening"] as const).map((slotKey) => {
        const row = scenarioSlots.find((s) => s.slot === slotKey);
        if (!row) return null;
        const item = activityToPlanItem(resolvedTargetDate, row.slot, row.activity);
        return (
          <div key={`${slotKey}-${row.activity.id}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: ".14em", color: "rgba(20,18,16,.55)" }}
            >
              {SLOT_LABEL[slotKey]}
            </span>
            <RecommendationCard
              item={item}
              onAddToPlan={() => void handleAddScenarioToPlan(row.slot, row.activity)}
            />
          </div>
        );
      })}

      {opts.showRegenerateCta ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {guestQuotaBlocked || guestRemainingGenerations === 0 ? (
            <div
              style={{
                position: "relative", overflow: "hidden",
                padding: "20px 18px",
                background: "linear-gradient(135deg, #FFE8DC, #FFF1E5)",
                border: "1px solid rgba(232,106,58,.25)",
                borderRadius: 18,
                display: "flex", flexDirection: "column", gap: 10,
              }}
            >
              <p
                className="font-display"
                style={{ margin: 0, fontSize: 20, fontWeight: 400, lineHeight: 1.05, letterSpacing: "-.02em", color: "#141210" }}
              >
                Сохраним ваш план<br/>и&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>подберём ещё</em>
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Link
                  href={loginHref}
                  style={{
                    height: 40, padding: "0 18px", borderRadius: 99,
                    background: "linear-gradient(180deg, #FBA77B, #E86A3A)",
                    color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none",
                    display: "inline-flex", alignItems: "center",
                    boxShadow: "0 8px 20px -6px rgba(232,106,58,.45)",
                  }}
                >Войти →</Link>
                <Link
                  href={registerHref}
                  style={{
                    height: 40, padding: "0 16px", borderRadius: 99,
                    border: "1px solid rgba(20,18,16,.18)",
                    background: "transparent", color: "#141210",
                    fontSize: 13, fontWeight: 500, textDecoration: "none",
                    display: "inline-flex", alignItems: "center",
                  }}
                >Регистрация</Link>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={loadingScenario || !guestCanGenerateMore}
                style={{
                  width: "100%", height: 46, borderRadius: 99,
                  border: "1px solid rgba(232,106,58,.45)",
                  background: "transparent", color: "#C24E22",
                  fontSize: 14, fontWeight: 500, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "border-color .15s",
                  fontFamily: "inherit",
                  opacity: (loadingScenario || !guestCanGenerateMore) ? 0.5 : 1,
                }}
              >
                <Sparkles size={14}/> Ещё варианты
              </button>
              <p
                className="font-mono uppercase text-center"
                style={{ margin: 0, fontSize: 10, letterSpacing: ".1em", color: "rgba(20,18,16,.55)" }}
              >
                {guestRemainingGenerations === 0
                  ? "● Генерации закончились · войдите, чтобы продолжить"
                  : `● ${formatRemainingGenerationsRu(guestRemainingGenerations ?? 3)} · затем войдите, чтобы продолжить`
                }
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );

  const renderGenerated = () => {
    const isLoadingEmpty = loadingScenario && scenarioSlots.length === 0;
    const isEmptyNotLoading = !loadingScenario && scenarioSlots.length === 0;
    // Quota-blocked gate is already rendered inside renderScenarioBlocks — don't duplicate it
    const quotaBlocked = guestQuotaBlocked || guestRemainingGenerations === 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h3
            className="font-display"
            style={{ margin: 0, fontSize: 26, fontWeight: 400, lineHeight: 1.05, letterSpacing: "-.02em", color: "#141210" }}
          >
            {whenChoice === "today"
              ? <>Вот что мы подобрали на&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>сегодня</em></>
              : whenChoice === "tomorrow"
                ? <>Вот что мы подобрали на&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>завтра</em></>
                : <>Вот что мы подобрали на&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>выходные</em></>
            }
          </h3>
          <p
            className="font-mono uppercase"
            style={{ marginTop: 6, fontSize: 11, letterSpacing: ".08em", color: "rgba(20,18,16,.55)" }}
          >
            {generatedPlanDateLine}
          </p>
        </div>

        {isLoadingEmpty ? (
          /* Skeleton while fetching */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {(["morning", "afternoon", "evening"] as const).map((sk) => (
              <div key={sk} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ height: 10, width: 48, borderRadius: 4, background: "rgba(20,18,16,.08)", animation: "pulse 1.5s ease-in-out infinite" }}/>
                <div style={{ height: 140, borderRadius: 20, background: "rgba(20,18,16,.05)", animation: "pulse 1.5s ease-in-out infinite" }}/>
              </div>
            ))}
          </div>
        ) : isEmptyNotLoading && quotaBlocked ? (
          /* Quota exhausted & no cards */
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <AuthGateCard />
            <p
              className="font-mono uppercase text-center"
              style={{ margin: 0, fontSize: 10, letterSpacing: ".1em", color: "rgba(20,18,16,.55)" }}
            >
              ● Генерации закончились · войдите, чтобы продолжить
            </p>
          </div>
        ) : isEmptyNotLoading && !quotaBlocked ? (
          /* Restored to generated phase with empty slots — offer to retry */
          <div style={{ paddingTop: 4 }}>
            <GuestPrimaryBtn onClick={() => void fetchScenario()} fullWidth>
              Подобрать варианты <ArrowRight size={14}/>
            </GuestPrimaryBtn>
          </div>
        ) : (
          /* Normal: cards available */
          renderScenarioBlocks({ showRegenerateCta: true })
        )}

        {/* Engagement auth gate — only when not already showing quota-blocked gate */}
        {authGateVisible && !quotaBlocked ? renderAuthGate() : null}
      </div>
    );
  };

  const renderEngaged = () => {
    const slotsOrder: GuestSlot[] = ["morning", "afternoon", "evening"];
    const committedCount = slotsOrder.filter((sk) => committedBySlot[sk]?.activity).length;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h3
          className="font-display"
          style={{ margin: 0, fontSize: 26, fontWeight: 400, lineHeight: 1.05, letterSpacing: "-.02em", color: "#141210" }}
        >
          {committedCount >= 2
            ? <>Ваш план <em style={{ fontStyle: "italic", color: "#C24E22" }}>готов!</em></>
            : <>Ваш план <em style={{ fontStyle: "italic", color: "#C24E22" }}>почти готов</em></>
          }
        </h3>

        {guestQuotaBlocked || guestRemainingGenerations === 0 ? <AuthGateCard /> : null}

        {slotsOrder.map((sk) => {
          const item = committedBySlot[sk];
          if (!item?.activity) return null;
          return (
            <div key={`committed-${sk}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                className="font-mono uppercase"
                style={{ fontSize: 10, letterSpacing: ".14em", color: "rgba(20,18,16,.55)" }}
              >
                {SLOT_LABEL[sk]}
              </span>
              <RecommendationCard
                item={item}
                isInPlan
                onRemoveFromPlan={() => handleRemoveCommitted(sk)}
              />
            </div>
          );
        })}

        {scenarioSlots.length > 0 ? (
          <div style={{ borderTop: "1px solid rgba(20,18,16,.10)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <span
              className="font-mono uppercase"
              style={{ fontSize: 11, letterSpacing: ".12em", color: "rgba(20,18,16,.55)" }}
            >
              Ещё идеи на этот день
            </span>
            {renderScenarioBlocks({ showRegenerateCta: false })}
          </div>
        ) : null}

        {/* Engagement gate: only when not already showing quota-blocked gate */}
        {authGateVisible && !(guestQuotaBlocked || guestRemainingGenerations === 0) ? renderAuthGate() : null}
      </div>
    );
  };

  /* ── Chip helper ── */
  const GuestChipGroup = ({
    label,
    items,
  }: {
    label: string;
    items: Array<{ id: string; label: React.ReactNode; active?: boolean; onClick?: () => void }>;
  }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <span
        className="font-mono uppercase"
        style={{ fontSize: 11, letterSpacing: ".14em", color: "rgba(20,18,16,.55)" }}
      >
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {items.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={chip.onClick}
            style={{
              height: 40, padding: "0 20px", borderRadius: 99,
              background: chip.active === true ? "#FFE8DC" : "#FAF7F1",
              border: chip.active === true ? "1px solid transparent" : "1px solid rgba(20,18,16,.10)",
              color: chip.active === true ? "#C24E22" : "#141210",
              fontSize: 14, fontWeight: chip.active === true ? 600 : 500,
              cursor: "pointer", transition: "all .15s",
              fontFamily: "inherit",
              display: "inline-flex", alignItems: "center",
              whiteSpace: "nowrap",
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );

  /* ── Primary CTA ── */
  const GuestPrimaryBtn = ({
    children,
    onClick,
    disabled,
    fullWidth,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    fullWidth?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: fullWidth ? "100%" : undefined,
        height: 54, padding: "0 28px", borderRadius: 99,
        background: disabled
          ? "rgba(232,106,58,.4)"
          : "linear-gradient(180deg, #FBA77B, #E86A3A)",
        color: "#fff",
        fontSize: 15, fontWeight: 600, letterSpacing: "-.005em",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
        cursor: disabled ? "not-allowed" : "pointer", border: 0,
        boxShadow: disabled ? "none" : "0 14px 32px -10px rgba(232,106,58,.5)",
        transition: "filter .2s, box-shadow .2s",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );

  /* ── Auth gate card (reusable) ── */
  const AuthGateCard = () => (
    <div
      style={{
        position: "relative", overflow: "hidden",
        padding: "22px 20px 20px",
        background: "linear-gradient(135deg, #FFE8DC, #FFF1E5)",
        border: "1px solid rgba(232,106,58,.25)",
        borderRadius: 20,
        display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      <span style={{
        position: "absolute", top: -40, right: -30, width: 140, height: 140, borderRadius: 99,
        background: "radial-gradient(circle, rgba(232,106,58,.2), transparent 65%)",
        pointerEvents: "none",
      }}/>
      <h4
        className="font-display"
        style={{
          margin: 0, fontSize: 24, fontWeight: 400, lineHeight: 1.05, letterSpacing: "-.02em",
          color: "#141210", position: "relative", zIndex: 1,
        }}
      >
        Сохраним ваш план<br/>и&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>подберём ещё</em>
      </h4>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#3A332B", position: "relative", zIndex: 1 }}>
        Войдите, чтобы сохранить план, получать напоминания и продолжить подбирать варианты.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, position: "relative", zIndex: 1 }}>
        <Link
          href={loginHref}
          style={{
            height: 46, padding: "0 22px", borderRadius: 99,
            background: "linear-gradient(180deg, #FBA77B, #E86A3A)",
            color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 8,
            boxShadow: "0 10px 24px -8px rgba(232,106,58,.45)",
          }}
        >
          Войти →
        </Link>
        <Link
          href={registerHref}
          style={{
            height: 46, padding: "0 18px", borderRadius: 99,
            background: "transparent", color: "#141210",
            border: "1px solid rgba(20,18,16,.18)",
            fontSize: 14, fontWeight: 500, textDecoration: "none",
            display: "inline-flex", alignItems: "center",
          }}
        >
          Регистрация
        </Link>
      </div>
    </div>
  );

  const body = (() => {
    switch (phase) {
      /* ── Step 1: Hook ── */
      case "empty":
        return (
          <div
            className="flex flex-col items-center text-center"
            style={{ gap: 20, padding: "8px 4px 16px" }}
          >
            <h3
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 36,
                fontWeight: 400, lineHeight: 1.05, letterSpacing: "-.01em",
                color: "#141210", maxWidth: 360,
              }}
            >
              Соберём план<br/>
              на&nbsp;<em style={{ fontStyle: "italic", color: "#C24E22" }}>сегодня</em>
              {" "}за&nbsp;<span style={{ fontFamily: "var(--font-display)" }}>10</span>&nbsp;секунд
            </h3>

            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "rgba(20,18,16,.55)", maxWidth: 320 }}>
              Подберём активности под&nbsp;вас и&nbsp;вашего ребёнка — без анкет и&nbsp;регистрации.
            </p>

            <GuestPrimaryBtn onClick={() => setPhase("onboarding")} fullWidth>
              <Sparkles size={14}/> Реши за меня <ArrowRight size={14}/>
            </GuestPrimaryBtn>

            {/* Trust line */}
            <div
              className="font-mono uppercase flex items-center gap-3"
              style={{ fontSize: 10, letterSpacing: ".1em", color: "rgba(20,18,16,.55)" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span style={{ width: 5, height: 5, borderRadius: 99, background: "#E86A3A", display: "inline-block" }}/>
                без регистрации
              </span>
              <span style={{ width: 3, height: 3, borderRadius: 99, background: "rgba(20,18,16,.4)", display: "inline-block" }}/>
              <span>3 подбора бесплатно</span>
            </div>

            <Link
              href={loginHref}
              style={{ fontSize: 13, color: "rgba(20,18,16,.55)", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Я сама подберу →
            </Link>
          </div>
        );

      /* ── Step 2: Filters / Onboarding ── */
      case "onboarding":
        return (
          <div className="flex flex-col" style={{ gap: 22 }}>
            <GuestChipGroup label="Кто идёт" items={whoChips}/>

            {!freeSearch && !goAdult ? (
              <GuestChipGroup label="Возраст" items={kidAgeChips}/>
            ) : null}

            <GuestChipGroup label="Когда" items={whenChips}/>
            <GuestChipGroup label="Формат" items={formatChips}/>

            <div style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>
              {guestQuotaBlocked || guestRemainingGenerations === 0 ? (
                <>
                  <AuthGateCard/>
                  <p
                    className="font-mono uppercase text-center"
                    style={{ margin: 0, fontSize: 10, letterSpacing: ".1em", color: "rgba(20,18,16,.55)" }}
                  >
                    ● Генерации закончились · войдите, чтобы продолжить
                  </p>
                </>
              ) : (
                <GuestPrimaryBtn
                  onClick={() => void fetchScenario({ showGeneratedShellFirst: true })}
                  disabled={loadingScenario || !guestCanGenerateMore}
                  fullWidth
                >
                  {loadingScenario ? "Подбираем…" : <>Найди варианты <ArrowRight size={14}/></>}
                </GuestPrimaryBtn>
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

  /* ── Step dots ── */
  const stepIdx = phase === "empty" ? 0 : phase === "onboarding" ? 1 : 2;
  const StepDots = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: i === stepIdx ? 20 : 6,
            height: 6,
            borderRadius: 99,
            background: i === stepIdx ? "#E86A3A" : i < stepIdx ? "#141210" : "rgba(20,18,16,.18)",
            transition: "all .25s",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );

  /* ── Footer nav ── */
  const footerBack = phase === "generated" || phase === "engaged"
    ? { label: "← Изменить", action: () => setPhase("onboarding") }
    : phase === "onboarding"
      ? { label: "← Назад", action: () => setPhase("empty") }
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: "#F6F2EA" }}>
      {/* Header */}
      <div
        className="flex-shrink-0"
        style={isDesktop ? { position: "sticky", top: 0, zIndex: 20 } : {}}
      >
        <MyPlanHeader onClose={onRequestClose} compact={!isDesktop} />
      </div>

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          background: "#F6F2EA",
          padding: isDesktop
            ? "24px 32px 16px"
            : "20px 20px 16px",
        }}
      >
        {body}
      </div>

      {/* Footer nav: back + step dots */}
      {phase !== "empty" && (
        <div
          className="flex-shrink-0"
          style={{
            borderTop: "1px solid rgba(20,18,16,.10)",
            background: "#F6F2EA",
            padding: "12px 20px calc(12px + env(safe-area-inset-bottom))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {footerBack ? (
            <button
              type="button"
              onClick={footerBack.action}
              style={{
                fontSize: 13, color: "rgba(20,18,16,.55)",
                background: "transparent", border: 0, cursor: "pointer",
                fontFamily: "inherit", padding: 0,
              }}
            >
              {footerBack.label}
            </button>
          ) : (
            <span/>
          )}
          <StepDots/>
          <span style={{ visibility: "hidden", fontSize: 13 }}>x</span>
        </div>
      )}
    </div>
  );
}
