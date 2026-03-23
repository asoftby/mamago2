"use client";

import type { ReactNode } from "react";
import { useBirthdayBuilderWithGate } from "../hooks/useBirthdayBuilderWithGate";
import { useBirthdayAgeSignals } from "../hooks/useBirthdayAgeSignals";
import { BirthdayAgeSignalHydration } from "./BirthdayAgeSignalHydration";
import { StepIntro } from "./steps/StepIntro";
import { StepTheme } from "./steps/StepTheme";
import { StepBudget } from "./steps/StepBudget";
import { StepPlace } from "./steps/StepPlace";
import { StepExtras } from "./steps/StepExtras";
import { StepAddons } from "./steps/StepAddons";
import { StepSummary } from "./steps/StepSummary";
import { StepConfirmation } from "./steps/StepConfirmation";
import { BirthdayBuilderStickyBar } from "./BirthdayBuilderStickyBar";
import { BirthdayBuilderAuthProvider } from "../context/BirthdayBuilderAuthContext";
import { PostLoginChildChoiceModal } from "./PostLoginChildChoiceModal";
import { getDisplayedAgeLabel } from "../lib/ageSignalMapper";

/** Bottom padding when sticky bar is visible (bar height + safe area) */
const STICKY_BAR_SPACER = "pb-24 sm:pb-20";

function BirthdayBuilderShellInner() {
  const builder = useBirthdayBuilderWithGate();
  const ageSignals = useBirthdayAgeSignals();
  const { state } = builder;
  const showStickyBar = true;

  const postLoginCurrentAgeLabel = getDisplayedAgeLabel({
    ageGroup: state.quiz.ageGroup,
    selectedAgeLabel: state.quiz.selectedAgeLabel,
  });

  let content: ReactNode = null;

  if (state.ui.currentStep === "intro") {
    content = (
      <>
        <div className={`px-4 py-6 max-w-2xl mx-auto ${STICKY_BAR_SPACER}`}>
          <StepIntro builder={builder} signals={ageSignals} />
        </div>
        {showStickyBar && <BirthdayBuilderStickyBar builder={builder} />}
      </>
    );
  } else if (state.ui.currentStep === "theme") {
    content = (
      <>
        <div className={`px-4 py-6 max-w-3xl mx-auto ${STICKY_BAR_SPACER}`}>
          <StepTheme builder={builder} />
        </div>
        {showStickyBar && <BirthdayBuilderStickyBar builder={builder} />}
      </>
    );
  } else if (state.ui.currentStep === "budget") {
    content = (
      <>
        <div className={`px-4 py-6 max-w-3xl mx-auto ${STICKY_BAR_SPACER}`}>
          <StepBudget builder={builder} />
        </div>
        {showStickyBar && <BirthdayBuilderStickyBar builder={builder} />}
      </>
    );
  } else if (state.ui.currentStep === "place") {
    content = (
      <>
        <div className={`px-4 py-6 max-w-3xl mx-auto ${STICKY_BAR_SPACER}`}>
          <StepPlace builder={builder} />
        </div>
        {showStickyBar && <BirthdayBuilderStickyBar builder={builder} />}
      </>
    );
  } else if (state.ui.currentStep === "extras") {
    content = (
      <>
        <div className={`px-4 py-6 max-w-3xl mx-auto ${STICKY_BAR_SPACER}`}>
          <StepExtras builder={builder} />
        </div>
        {showStickyBar && <BirthdayBuilderStickyBar builder={builder} />}
      </>
    );
  } else if (["entertainment", "food", "decor"].includes(state.ui.currentStep)) {
    content = (
      <>
        <div className={`px-4 py-6 max-w-3xl mx-auto ${STICKY_BAR_SPACER}`}>
          <StepAddons builder={builder} />
        </div>
        {showStickyBar && <BirthdayBuilderStickyBar builder={builder} />}
      </>
    );
  } else if (state.ui.currentStep === "summary") {
    content = (
      <>
        <div className={`px-4 py-6 max-w-3xl mx-auto ${STICKY_BAR_SPACER}`}>
          <StepSummary builder={builder} />
        </div>
        {showStickyBar && <BirthdayBuilderStickyBar builder={builder} />}
      </>
    );
  } else if (state.ui.currentStep === "confirm") {
    content = (
      <>
        <div className={`px-4 py-6 max-w-3xl mx-auto ${STICKY_BAR_SPACER}`}>
          <StepConfirmation builder={builder} />
        </div>
        {showStickyBar && <BirthdayBuilderStickyBar builder={builder} />}
      </>
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
      {content}
    </>
  );
}

export function BirthdayBuilderShell() {
  return (
    <BirthdayBuilderAuthProvider>
      <BirthdayBuilderShellInner />
    </BirthdayBuilderAuthProvider>
  );
}
