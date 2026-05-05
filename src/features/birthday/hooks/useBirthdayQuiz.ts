"use client";

import { useState, useMemo } from "react";
import type {
  BirthdayQuizState,
  BirthdayAgeGroup,
  BirthdayFormatChoice,
  BirthdayGuestsGroup,
  BirthdayBudgetGroup,
  BirthdayCandidateGroup,
} from "../types/birthday";
import { birthdayOffers } from "../data/birthdayOffers";
import { filterBirthdayOffers } from "../lib/filterBirthdayOffers";
import { groupBirthdayCandidates } from "../lib/groupBirthdayCandidates";

const TOTAL_STEPS = 4;

const initialState: BirthdayQuizState = {
  currentStep: 0,
  ageGroup: null,
  format: null,
  guestsGroup: null,
  budgetGroup: null,
  selectedOfferIds: [],
};

export function useBirthdayQuiz() {
  const [state, setState] = useState<BirthdayQuizState>(initialState);

  const filteredOffers = useMemo(() => {
    return filterBirthdayOffers(birthdayOffers, {
      ageGroup: state.ageGroup,
      format: state.format,
      guestsGroup: state.guestsGroup,
      budgetGroup: state.budgetGroup,
    });
  }, [state.ageGroup, state.format, state.guestsGroup, state.budgetGroup]);

  const candidateGroups: BirthdayCandidateGroup[] = useMemo(() => {
    if (!state.ageGroup && !state.format && !state.guestsGroup && !state.budgetGroup) return [];
    return groupBirthdayCandidates(filteredOffers);
  }, [filteredOffers, state.ageGroup, state.format, state.guestsGroup, state.budgetGroup]);

  function setAgeGroup(v: BirthdayAgeGroup) {
    setState((s) => ({ ...s, ageGroup: v }));
  }
  function setFormat(v: BirthdayFormatChoice) {
    setState((s) => ({ ...s, format: v }));
  }
  function setGuestsGroup(v: BirthdayGuestsGroup) {
    setState((s) => ({ ...s, guestsGroup: v }));
  }
  function setBudgetGroup(v: BirthdayBudgetGroup) {
    setState((s) => ({ ...s, budgetGroup: v }));
  }
  function nextStep() {
    setState((s) => ({ ...s, currentStep: Math.min(s.currentStep + 1, TOTAL_STEPS + 1) }));
  }
  function prevStep() {
    setState((s) => ({ ...s, currentStep: Math.max(s.currentStep - 1, 0) }));
  }
  function resetQuiz() {
    setState(initialState);
  }
  function toggleSelectedOffer(id: string) {
    setState((s) => ({
      ...s,
      selectedOfferIds: s.selectedOfferIds.includes(id)
        ? s.selectedOfferIds.filter((x) => x !== id)
        : [...s.selectedOfferIds, id],
    }));
  }
  function goToResults() {
    setState((s) => ({ ...s, currentStep: TOTAL_STEPS + 1 }));
  }

  const canGoNext =
    (state.currentStep === 1 && state.ageGroup !== null) ||
    (state.currentStep === 2 && state.format !== null) ||
    (state.currentStep === 3 && state.guestsGroup !== null) ||
    (state.currentStep === 4 && state.budgetGroup !== null) ||
    state.currentStep === 0;

  return {
    state,
    filteredOffers,
    candidateGroups,
    totalSteps: TOTAL_STEPS,
    canGoNext,
    setAgeGroup,
    setFormat,
    setGuestsGroup,
    setBudgetGroup,
    nextStep,
    prevStep,
    resetQuiz,
    toggleSelectedOffer,
    goToResults,
  };
}
