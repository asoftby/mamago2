"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBirthdayBuilderWithGate } from "../hooks/useBirthdayBuilderWithGate";
import { useBirthdayAgeSignals } from "../hooks/useBirthdayAgeSignals";
import { BirthdayAgeSignalHydration } from "./BirthdayAgeSignalHydration";
import { BirthdayBuilderAuthProvider } from "../context/BirthdayBuilderAuthContext";
import { PostLoginChildChoiceModal } from "./PostLoginChildChoiceModal";
import { getDisplayedAgeLabel } from "../lib/ageSignalMapper";
import { StepWhen } from "./steps/StepWhen";
import { StepWho } from "./steps/StepWho";
import { StepFormat } from "./steps/StepFormat";
import { StepPick } from "./steps/StepPick";
import { StepDone } from "./steps/StepDone";
import { BuilderProgressDots } from "./BuilderProgressDots";
import { BuilderSummaryBar } from "./BuilderSummaryBar";
import type { BuilderStep } from "../types/builder";
import { BookingStatusPage } from "@/features/me/components/BookingStatusPage";
import type {
  PerformerStatus,
  ScenarioTimelineItem,
  UserBirthdayPartyDetail,
} from "@/features/me/types/userBirthdayParty";

// Mock catalog price lookup
const MOCK_PRICES: Record<string, { title: string; tag: string; price: number }> = {
  v1: { title: "Лофт «Облака» · «Всё включено»", tag: "площадка", price: 480 },
  v2: { title: "Игровая «Тропинка» в ТЦ", tag: "площадка", price: 200 },
  v3: { title: "Антикафе «Тайм» · отдельная комната", tag: "площадка", price: 150 },
  a1: { title: "Шоу принцесс · 2 актёра", tag: "аниматор", price: 160 },
  a2: { title: "Научное шоу с опытами", tag: "аниматор", price: 190 },
  a3: { title: "Мыльные пузыри · большое шоу", tag: "аниматор", price: 140 },
  f1: { title: "Торт на заказ · 3 кг", tag: "торт", price: 120 },
  f2: { title: "Кэнди-бар · сладкий стол", tag: "еда", price: 160 },
  d1: { title: "Фотозона + шары по теме", tag: "декор", price: 140 },
  d2: { title: "Аквагрим для гостей", tag: "декор", price: 90 },
};

const BUDGET_MAX: Record<string, number> = {
  up300: 300,
  "300-600": 600,
  "600-1000": 1000,
  "1000plus": 999999,
};

const NEXT_LABELS: Partial<Record<BuilderStep, string>> = {
  when: "Далее — для кого",
  who: "Далее — формат",
  format: "Далее — подбор",
  pick: "Далее — готово",
};

function canProceedFromStep(
  step: BuilderStep,
  state: ReturnType<typeof useBirthdayBuilderWithGate>["state"]
): boolean {
  switch (step) {
    case "when":
      return Boolean(state.quiz.dateRangeFrom);
    case "who":
      return Boolean(state.quiz.guestsGroup);
    case "format":
      return Boolean(state.quiz.placeType) && Boolean(state.quiz.budgetGroup);
    case "pick":
      return Boolean(state.selection.selectedBaseId);
    default:
      return true;
  }
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

interface Props {
  citySlug: string;
}

function minsToTimeWrapped(mins: number): string {
  const minutesPerDay = 24 * 60;
  const wrapped = ((mins % minutesPerDay) + minutesPerDay) % minutesPerDay;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function buildMockScenarioTimeline(
  summaryItems: { id: string; title: string; tag: string; price: number }[],
  itemSchedules: Record<
    string,
    { startAt: string | null; endAt: string | null; deliveryBeforeAt: string | null }
  >,
): ScenarioTimelineItem[] {
  const venue = summaryItems.find((item) => item.tag === "площадка");
  const animator = summaryItems.find((item) => item.tag === "аниматор");
  const cake = summaryItems.find(
    (item) => item.tag === "торт" || item.tag === "еда",
  );
  const venueSchedule = venue ? itemSchedules[venue.id] : null;
  const venueStartMins = timeToMinutes(venueSchedule?.startAt);
  const venueEndMins = timeToMinutes(venueSchedule?.endAt);

  const performerItems: ScenarioTimelineItem[] = summaryItems.map((item) => {
    const schedule = itemSchedules[item.id];
    const timeLabel =
      item.tag === "торт" || item.tag === "еда"
        ? schedule?.deliveryBeforeAt
          ? `${schedule.deliveryBeforeAt}`
          : "12:30"
        : schedule?.startAt && schedule?.endAt
          ? `${schedule.startAt}–${schedule.endAt}`
          : "время уточняется";

    const baseItem: ScenarioTimelineItem = {
      id: item.id,
      time: item.tag === "торт" || item.tag === "еда" ? timeLabel : timeLabel,
      type: "performer",
      title:
        item.tag === "торт" || item.tag === "еда"
          ? "Торт доставить на площадку"
          : item.tag === "площадка"
            ? "Площадка"
            : item.tag === "аниматор"
              ? "Аниматор"
              : item.title,
      subtitle: item.title,
      price: item.price,
    };

    if (item.tag === "площадка") {
      return {
        ...baseItem,
        status: "CONFIRMED" satisfies PerformerStatus,
        contactLabel: "Контакт площадки",
        contact: {
          name: "Анна",
          phone: "+375 29 555–80–80",
          messageHref: "https://t.me/mamago_loft",
        },
      };
    }

    if (item.tag === "торт" || item.tag === "еда") {
      return {
        ...baseItem,
        status: "CONFIRMED" satisfies PerformerStatus,
        contactLabel: "Контакт",
        contact: {
          name: "Татьяна",
          phone: "+375 29 123–45–67",
          telegram: "https://t.me/mamago_cakes",
        },
      };
    }

    if (item.tag === "аниматор") {
      return {
        ...baseItem,
        status: "DECLINED" satisfies PerformerStatus,
        alternatives: [
          {
            id: "alt-bubbles",
            category: "Аниматор",
            title: "Шоу мыльных пузырей",
            rating: 4.8,
            price: 170,
          },
          {
            id: "alt-magician",
            category: "Аниматор",
            title: "Фокусник для детей",
            rating: 4.9,
            price: 200,
          },
          {
            id: "alt-minecraft",
            category: "Аниматор",
            title: "Аниматор в стиле Minecraft",
            rating: 4.7,
            price: 220,
          },
        ],
      };
    }

    return {
      ...baseItem,
      status: "PENDING" satisfies PerformerStatus,
    };
  });

  const internalItems: ScenarioTimelineItem[] =
    venueStartMins != null && venueEndMins != null
      ? [
          {
            id: "guest-welcome",
            time: minsToTimeWrapped(venueStartMins + 30),
            type: "internal",
            title: "Сбор гостей",
            description: "15 мин на встречу гостей и welcome-зону",
          },
          {
            id: "cake-out",
            time: minsToTimeWrapped(Math.max(venueStartMins + 135, venueEndMins - 45)),
            type: "internal",
            title: "Вынос торта и поздравление",
            description: "после завершения шоу",
          },
          {
            id: "free-program",
            time: `${minsToTimeWrapped(Math.max(venueStartMins + 150, venueEndMins - 30))}–${minsToTimeWrapped(venueEndMins)}`,
            type: "internal",
            title: "Свободная программа / фото / завершение",
          },
        ]
      : [];

  const allItems = [...performerItems, ...internalItems];

  return allItems.sort((a, b) => {
    const parseValue = (value: string) => {
      const first = value.replace(/^до\s+/, "").split("–")[0]?.trim() ?? value;
      return timeToMinutes(first) ?? 0;
    };
    return parseValue(a.time) - parseValue(b.time);
  });
}

function buildSubmittedScenarioParty(params: {
  state: ReturnType<typeof useBirthdayBuilderWithGate>["state"];
  summaryItems: { id: string; title: string; tag: string; price: number }[];
  totalPrice: number;
}): UserBirthdayPartyDetail {
  const { state, summaryItems, totalPrice } = params;
  const timelineItems = buildMockScenarioTimeline(
    summaryItems,
    state.partyPlanning.itemSchedules as Record<
      string,
      { startAt: string | null; endAt: string | null; deliveryBeforeAt: string | null }
    >,
  );
  const confirmedCount = timelineItems.filter(
    (item) => item.status === "CONFIRMED",
  ).length;
  const performerTotal = timelineItems.filter(
    (item) => item.type === "performer",
  ).length;
  const guestsLabelMap: Record<string, string> = {
    up5: "до 5 детей",
    "5-10": "5–10 детей",
    "10-15": "10–15 детей",
    "15plus": "15+ детей",
  };

  return {
    id: "builder-submitted-scenario",
    userId: "__builder__",
    childName: state.quiz.partyForChild?.name ?? "Ребёнок",
    title: state.quiz.partyForChild
      ? `Праздник ${state.quiz.partyForChild.name}`
      : "Сценарий праздника",
    status: confirmedCount >= performerTotal ? "ready" : "partial",
    dateIso: state.quiz.dateRangeFrom,
    timeStart: state.partyPlanning.timeStart ?? "15:00",
    timeEnd:
      state.selection.selectedBaseId != null
        ? state.partyPlanning.itemSchedules[state.selection.selectedBaseId]?.endAt ?? null
        : null,
    previewItems: summaryItems.map((item) => item.title),
    confirmationCount: confirmedCount,
    confirmationTotal: performerTotal,
    scenarioFlow: summaryItems.map((item) => ({
      slot:
        item.tag === "площадка"
          ? "place"
          : item.tag === "аниматор"
            ? "animator"
            : item.tag === "торт"
              ? "cake"
              : item.tag === "еда"
                ? "food"
                : item.tag === "декор"
                  ? "decor"
                  : "other",
      confirmed: item.tag === "площадка" || item.tag === "торт" || item.tag === "еда",
    })),
    updatedAt: new Date().toISOString(),
    scenarioLines: summaryItems.map((item) => item.title),
    scenarioFlowLabels: summaryItems.map((item) => item.title),
    themeLabel: null,
    durationHint: null,
    services: [],
    organizers: [],
    formatLabel: state.quiz.placeType === "VENUE" ? "На площадке" : "Праздник",
    childAgeLabel: state.quiz.partyForChild?.ageLabel ?? null,
    guestsLabel: state.quiz.guestsGroup
      ? guestsLabelMap[state.quiz.guestsGroup] ?? null
      : null,
    totalPrice,
    timelineItems,
  };
}

function BirthdayBuilderShellInner({ citySlug }: Props) {
  const router = useRouter();
  const builder = useBirthdayBuilderWithGate();
  const ageSignals = useBirthdayAgeSignals();
  const closeFallbackHref = `/${citySlug}/birthday`;

  const handleClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(closeFallbackHref);
  };
  const { state, nextStep, prevStep } = builder;
  const currentStep = state.ui.currentStep as BuilderStep;
  const [submittedScenario, setSubmittedScenario] =
    useState<UserBirthdayPartyDetail | null>(null);

  const postLoginCurrentAgeLabel = getDisplayedAgeLabel({
    ageGroup: state.quiz.ageGroup,
    selectedAgeLabel: state.quiz.selectedAgeLabel,
  });

  const summaryItems = useMemo(() => {
    const items: { id: string; title: string; tag: string; price: number }[] = [];
    const baseId = state.selection.selectedBaseId;
    if (baseId && MOCK_PRICES[baseId]) {
      items.push({ id: baseId, ...MOCK_PRICES[baseId] });
    }
    for (const id of state.selection.selectedAddonIds) {
      if (MOCK_PRICES[id]) items.push({ id, ...MOCK_PRICES[id] });
    }
    return items;
  }, [state.selection.selectedBaseId, state.selection.selectedAddonIds]);

  const totalPrice = useMemo(
    () => summaryItems.reduce((sum, i) => sum + i.price, 0),
    [summaryItems]
  );

  const maxBudget = state.quiz.budgetGroup
    ? (BUDGET_MAX[state.quiz.budgetGroup] ?? 999999)
    : 999999;
  const overBudget = totalPrice > 0 && totalPrice > maxBudget;

  const canNext = canProceedFromStep(currentStep, state);
  const nextLabel = NEXT_LABELS[currentStep] ?? "Далее";

  if (submittedScenario) {
    return (
      <BookingStatusPage
        party={submittedScenario}
        title={submittedScenario.title ?? `Праздник ${submittedScenario.childName}`}
        dateTimeLine={null}
        onBack={() => setSubmittedScenario(null)}
      />
    );
  }

  return (
    <>
      <BirthdayAgeSignalHydration builder={builder} signals={ageSignals} />
      <PostLoginChildChoiceModal
        open={builder.postLoginChildModalOpen}
        onOpenChange={builder.handlePostLoginModalOpenChange}
        childrenList={builder.postLoginChildrenList}
        currentAgeLabel={postLoginCurrentAgeLabel}
        onChooseChild={(child) => builder.resolvePostLoginChildChoice(child)}
        onKeepManual={() => builder.resolvePostLoginChildChoice("manual")}
      />

      {/* Grain overlay */}
      <style>{`
        @keyframes dm-fade{from{opacity:0}to{opacity:1}}
        @keyframes dm-pop{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
        .pb-grain::before{
          content:"";position:fixed;inset:0;pointer-events:none;z-index:1000;
          background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .35 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          opacity:.04;mix-blend-mode:multiply;
        }
      `}</style>

      <div
        className="pb-grain"
        style={{
          minHeight: "100vh",
          background: "#fff",
          color: "#141210",
          WebkitFontSmoothing: "antialiased",
          paddingBottom: 92,
        }}
      >
        {/* Top bar */}
        <div
          style={{
            borderBottom: "1px solid rgba(20,18,16,.10)",
            background: "rgba(255,255,255,.6)",
            position: "sticky",
            top: 0,
            zIndex: 50,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 28px",
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              aria-label="Закрыть"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 36,
                padding: "0 14px 0 10px",
                borderRadius: 999,
                border: "1px solid rgba(20,18,16,.18)",
                fontSize: 13,
                fontWeight: 500,
                color: "#3A332B",
                background: "transparent",
                cursor: "pointer",
                transition: "all .15s",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 99, background: "rgba(20,18,16,.08)" }}>
                <CloseIcon />
              </span>
              Закрыть
            </button>
            <BuilderProgressDots currentStep={currentStep} />
          </div>
        </div>

        {/* Step content */}
        <main
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "36px 28px 48px",
          }}
        >
          {currentStep === "when" && <StepWhen builder={builder} />}
          {currentStep === "who" && <StepWho builder={builder} ageSignals={ageSignals} />}
          {currentStep === "format" && <StepFormat builder={builder} />}
          {currentStep === "pick" && <StepPick builder={builder} />}
          {currentStep === "done" && (
            <StepDone
              builder={builder}
              totalPrice={totalPrice}
              summaryItems={summaryItems}
              onSubmitScenario={() =>
                setSubmittedScenario(
                  buildSubmittedScenarioParty({
                    state,
                    summaryItems,
                    totalPrice,
                  }),
                )
              }
            />
          )}
        </main>

        {/* Summary sticky bar */}
        <BuilderSummaryBar
          state={state}
          totalPrice={totalPrice}
          overBudget={overBudget}
          currentStep={currentStep}
          onBack={prevStep}
          onNext={nextStep}
          canNext={canNext}
          nextLabel={nextLabel}
          showDone={currentStep === "done"}
        />
      </div>
    </>
  );
}

export function BirthdayBuilderShell({ citySlug }: Props) {
  return (
    <BirthdayBuilderAuthProvider>
      <BirthdayBuilderShellInner citySlug={citySlug} />
    </BirthdayBuilderAuthProvider>
  );
}
