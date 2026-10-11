"use client";

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
import { BuilderProgressDots } from "./BuilderProgressDots";
import { BuilderSummaryBar } from "./BuilderSummaryBar";
import type { BuilderStep } from "../types/builder";

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

  const postLoginCurrentAgeLabel = getDisplayedAgeLabel({
    ageGroup: state.quiz.ageGroup,
    selectedAgeLabel: state.quiz.selectedAgeLabel,
  });

  // PR 1: catalog and booking persistence are not connected yet.
  // Never derive prices, availability or successful bookings from demo IDs.
  const totalPrice = 0;
  const overBudget = false;
  const canNext = currentStep !== "pick" && currentStep !== "done" &&
    canProceedFromStep(currentStep, state);
  const nextLabel = NEXT_LABELS[currentStep] ?? "Далее";

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
          {currentStep === "pick" && <StepPick citySlug={citySlug} />}
          {currentStep === "done" && <StepPick citySlug={citySlug} />}
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
