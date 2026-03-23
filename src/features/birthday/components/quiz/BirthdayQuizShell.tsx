"use client";

import { useBirthdayQuiz } from "../../hooks/useBirthdayQuiz";
import { BirthdayQuizIntro } from "./BirthdayQuizIntro";
import { BirthdayQuizStepLayout } from "./BirthdayQuizStepLayout";
import { BirthdayStickySummary } from "./BirthdayStickySummary";
import { BirthdayResultsPage } from "../results/BirthdayResultsPage";
import { StepAge } from "./steps/StepAge";
import { StepFormat } from "./steps/StepFormat";
import { StepGuests } from "./steps/StepGuests";
import { StepBudget } from "./steps/StepBudget";

const STEP_META = [
  { title: "Сколько лет имениннику?", subtitle: "Подберём программу под возраст" },
  { title: "Где хотите отметить?", subtitle: "Формат праздника влияет на выбор площадки и программы" },
  { title: "Сколько детей придёт?", subtitle: "Это поможет подобрать подходящую площадку" },
  { title: "Какой бюджет?", subtitle: "Покажем предложения в вашем диапазоне" },
];

export function BirthdayQuizShell() {
  const quiz = useBirthdayQuiz();
  const { state, filteredOffers, candidateGroups, totalSteps, canGoNext } = quiz;

  // Intro
  if (state.currentStep === 0) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <BirthdayQuizIntro onStart={quiz.nextStep} />
      </div>
    );
  }

  // Results
  if (state.currentStep > totalSteps) {
    return (
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <BirthdayResultsPage
          state={state}
          filteredOffers={filteredOffers}
          onReset={quiz.resetQuiz}
        />
      </div>
    );
  }

  const stepMeta = STEP_META[state.currentStep - 1];

  return (
    <div className="px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-8 lg:items-start">
          {/* Main content */}
          <BirthdayQuizStepLayout
            step={state.currentStep}
            totalSteps={totalSteps}
            title={stepMeta.title}
            subtitle={stepMeta.subtitle}
            candidateGroups={candidateGroups}
            totalCandidates={filteredOffers.length}
            onBack={quiz.prevStep}
          >
            {state.currentStep === 1 && (
              <StepAge value={state.ageGroup} onChange={quiz.setAgeGroup} />
            )}
            {state.currentStep === 2 && (
              <StepFormat value={state.format} onChange={quiz.setFormat} />
            )}
            {state.currentStep === 3 && (
              <StepGuests value={state.guestsGroup} onChange={quiz.setGuestsGroup} />
            )}
            {state.currentStep === 4 && (
              <StepBudget value={state.budgetGroup} onChange={quiz.setBudgetGroup} />
            )}
          </BirthdayQuizStepLayout>

          {/* Sticky summary (desktop sidebar + mobile bottom bar) */}
          <BirthdayStickySummary
            state={state}
            totalCount={filteredOffers.length}
            canGoNext={canGoNext}
            onNext={quiz.nextStep}
            onViewResults={quiz.goToResults}
            currentStep={state.currentStep}
            totalSteps={totalSteps}
          />
        </div>
      </div>
    </div>
  );
}
