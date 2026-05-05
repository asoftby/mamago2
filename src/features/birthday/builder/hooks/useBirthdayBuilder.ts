"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  BirthdayAgeGroup,
  BirthdayGuestsGroup,
  BirthdayBudgetGroup,
  BirthdayTheme,
  BirthdayOffer,
} from "../../types/birthday";
import type {
  BirthdayBuilderState,
  BuilderStep,
  PartyForChild,
  PartyPlanning,
  PlaceType,
} from "../types/builder";
import { ageYearsFromBirthDate, formatYearsRu } from "../lib/partyChildUtils";
import { BUILDER_STEP_ORDER } from "../lib/stepOrder";
import { birthdayOffers } from "../../data/birthdayOffers";
import { revalidateAddons } from "../lib/compatibility";

function mergeQuizDefaults(quiz: BirthdayBuilderState["quiz"]): BirthdayBuilderState["quiz"] {
  return {
    ...quiz,
    ageSource: quiz.ageSource ?? "manual",
    interestsSource: quiz.interestsSource ?? "manual",
  };
}

function mergeLoadedState(raw: BirthdayBuilderState): BirthdayBuilderState {
  return {
    ...raw,
    quiz: mergeQuizDefaults(raw.quiz),
  };
}

const initialState: BirthdayBuilderState = {
  quiz: {
    partyForChild: null,
    ageSource: "manual",
    interestsSource: "manual",
    ageGroup: null,
    selectedAgeSignalId: null,
    selectedAgeLabel: null,
    budgetGroup: null,
    guestsGroup: null,
    theme: null,
    placeType: null,
  },
  selection: {
    selectedBaseId: null,
    selectedAddonIds: [],
  },
  validation: {
    conflicts: [],
  },
  ui: {
    currentStep: "intro",
  },
  partyPlanning: {
    dateIso: null,
    timeStart: null,
    timeEnd: null,
  },
};

const VALID_AGE_GROUPS: BirthdayAgeGroup[] = ["0-3", "3-5", "5-8", "8-12"];

function ageGroupFromYears(years: number): BirthdayAgeGroup {
  if (years < 3) return "0-3";
  if (years < 5) return "3-5";
  if (years < 8) return "5-8";
  return "8-12";
}

/** Ребёнок из GET /api/children для применения к сценарию после логина */
export type ProfileChildPayload = {
  id: string;
  name: string;
  birthDate: string;
  systemInterests?: { interestSlug: string }[];
};

const AGE_URL_MAP: Record<string, BirthdayAgeGroup> = {
  "0-3": "0-3",
  "3-5": "3-5",
  "5-7": "5-8",
  "5-8": "5-8",
  "6-10": "5-8",
  "8-12": "8-12",
  "10+": "8-12",
  "10": "8-12",
};

export function parseAgeFromSearchParams(searchParams: URLSearchParams): BirthdayAgeGroup | null {
  const age = searchParams.get("age");
  if (!age) return null;
  const normalized = age.toLowerCase().replace(/\s/g, "");
  return AGE_URL_MAP[normalized] ?? (VALID_AGE_GROUPS.includes(normalized as BirthdayAgeGroup) ? (normalized as BirthdayAgeGroup) : null);
}

export function useBirthdayBuilder(init?: { ageGroup?: BirthdayAgeGroup | null }) {
  const [state, setState] = useState<BirthdayBuilderState>(() => {
    const base = JSON.parse(JSON.stringify(initialState)) as BirthdayBuilderState;
    if (init?.ageGroup) {
      base.quiz.ageGroup = init.ageGroup;
      base.quiz.selectedAgeSignalId = null;
      base.quiz.selectedAgeLabel = null;
      base.quiz.partyForChild = null;
      base.quiz.ageSource = "manual";
      base.quiz.interestsSource = "manual";
      base.ui.currentStep = "theme";
    }
    return base;
  });

  // ─── Derived data ──────────────────────────────────────────────────────────

  const selectedBase = useMemo(() => {
    if (!state.selection.selectedBaseId) return null;
    return birthdayOffers.find((o) => o.id === state.selection.selectedBaseId) || null;
  }, [state.selection.selectedBaseId]);

  const selectedAddons = useMemo(() => {
    return birthdayOffers.filter((o) => state.selection.selectedAddonIds.includes(o.id));
  }, [state.selection.selectedAddonIds]);

  const allSelectedOffers = useMemo(() => {
    const offers: BirthdayOffer[] = [];
    if (selectedBase) offers.push(selectedBase);
    offers.push(...selectedAddons);
    return offers;
  }, [selectedBase, selectedAddons]);

  /** True if user has a valid base: either selected venue/package OR HOME/OUTDOOR format */
  const hasValidBase = useMemo(() => {
    if (state.selection.selectedBaseId) return true;
    const pt = state.quiz.placeType;
    return pt === "HOME" || pt === "OUTDOOR";
  }, [state.selection.selectedBaseId, state.quiz.placeType]);

  // ─── Quiz actions ──────────────────────────────────────────────────────────

  const setBasics = useCallback(
    (params: {
      ageGroup?: BirthdayAgeGroup | null;
      selectedAgeSignalId?: string | null;
      selectedAgeLabel?: string | null;
      budgetGroup?: BirthdayBudgetGroup;
      guestsGroup?: BirthdayGuestsGroup;
      theme?: BirthdayTheme;
    }) => {
      setState((s) => {
        const newQuiz = { ...s.quiz };
        
        if (params.ageGroup !== undefined) {
          if (params.ageGroup === null) {
            newQuiz.ageGroup = null;
            newQuiz.selectedAgeSignalId = null;
            newQuiz.selectedAgeLabel = null;
          } else if (s.quiz.ageGroup === params.ageGroup) {
            newQuiz.ageGroup = null;
            newQuiz.selectedAgeSignalId = null;
            newQuiz.selectedAgeLabel = null;
          } else {
            newQuiz.ageGroup = params.ageGroup;
            newQuiz.selectedAgeSignalId =
              params.selectedAgeSignalId ?? null;
            newQuiz.selectedAgeLabel =
              params.selectedAgeLabel ?? null;
          }
          newQuiz.ageSource = "manual";
        } else if (params.selectedAgeSignalId !== undefined) {
          newQuiz.selectedAgeSignalId = params.selectedAgeSignalId;
          newQuiz.ageSource = "manual";
        }
        if (params.selectedAgeLabel !== undefined && params.ageGroup === undefined) {
          newQuiz.selectedAgeLabel = params.selectedAgeLabel;
          newQuiz.ageSource = "manual";
        }
        if (params.budgetGroup !== undefined) {
          newQuiz.budgetGroup = s.quiz.budgetGroup === params.budgetGroup ? null : params.budgetGroup;
        }
        if (params.guestsGroup !== undefined) {
          newQuiz.guestsGroup = s.quiz.guestsGroup === params.guestsGroup ? null : params.guestsGroup;
        }
        if (params.theme !== undefined) {
          newQuiz.theme = s.quiz.theme === params.theme ? null : params.theme;
        }
        
        return {
          ...s,
          quiz: newQuiz,
        };
      });
    },
    []
  );

  const setPartyForChild = useCallback((partyForChild: PartyForChild | null) => {
    setState((s) => {
      const linked = partyForChild?.profileChildId != null;
      return {
        ...s,
        quiz: {
          ...s.quiz,
          partyForChild,
          ageSource: linked ? "child" : "manual",
          interestsSource: linked ? "child" : "manual",
        },
      };
    });
  }, []);

  const applyProfileChildToScenario = useCallback((child: ProfileChildPayload) => {
    const birthIso =
      typeof child.birthDate === "string"
        ? child.birthDate.slice(0, 10)
        : new Date(child.birthDate).toISOString().slice(0, 10);
    const years = ageYearsFromBirthDate(birthIso);
    const ageGroup = ageGroupFromYears(years);
    const selectedAgeLabel = formatYearsRu(years);
    const interestSlugs = (child.systemInterests ?? [])
      .map((x) => x.interestSlug)
      .filter(Boolean);

    setState((s) => {
      const partyForChild: PartyForChild = {
        profileChildId: child.id,
        name: child.name,
        ageLabel: selectedAgeLabel,
        birthDateIso: birthIso,
        interestSlugs,
      };
      const newBase = birthdayOffers.find((o) => o.id === s.selection.selectedBaseId) || null;
      const conflicts = revalidateAddons(
        s.selection.selectedAddonIds,
        birthdayOffers,
        newBase,
        s.quiz.placeType,
      );
      return {
        ...s,
        quiz: {
          ...s.quiz,
          partyForChild,
          ageGroup,
          selectedAgeSignalId: null,
          selectedAgeLabel,
          ageSource: "child",
          interestsSource: "child",
        },
        validation: { conflicts },
      };
    });
  }, []);

  const confirmManualScenarioAfterLogin = useCallback(() => {
    setState((s) => ({
      ...s,
      quiz: {
        ...s.quiz,
        ageSource: "manual",
        interestsSource: "manual",
      },
    }));
  }, []);

  const setPlaceType = useCallback((placeType: PlaceType) => {
    setState((s) => {
      // Toggle behavior: if clicking same placeType, unselect it
      const newPlaceType = s.quiz.placeType === placeType ? null : placeType;

      // When switching to HOME/OUTDOOR, clear venue selection (no venue to show)
      const newBaseId =
        newPlaceType === "HOME" || newPlaceType === "OUTDOOR" ? null : s.selection.selectedBaseId;
      const newBase = newBaseId
        ? birthdayOffers.find((o) => o.id === newBaseId) || null
        : null;

      const conflicts = revalidateAddons(
        s.selection.selectedAddonIds,
        birthdayOffers,
        newBase,
        newPlaceType
      );

      return {
        ...s,
        quiz: { ...s.quiz, placeType: newPlaceType },
        selection: { ...s.selection, selectedBaseId: newBaseId },
        validation: { conflicts },
      };
    });
  }, []);

  // ─── Selection actions ─────────────────────────────────────────────────────

  const selectBase = useCallback((offerId: string) => {
    setState((s) => {
      // Toggle behavior: if clicking same base, unselect it
      const newBaseId = s.selection.selectedBaseId === offerId ? null : offerId;
      const newBase = newBaseId ? birthdayOffers.find((o) => o.id === newBaseId) || null : null;
      
      // Revalidate all addons against new base
      const conflicts = revalidateAddons(
        s.selection.selectedAddonIds,
        birthdayOffers,
        newBase,
        s.quiz.placeType
      );

      return {
        ...s,
        selection: {
          ...s.selection,
          selectedBaseId: newBaseId,
        },
        validation: {
          conflicts,
        },
      };
    });
  }, []);

  const replaceBase = useCallback((newOfferId: string) => {
    // Same as selectBase — replaces current base and revalidates
    selectBase(newOfferId);
  }, [selectBase]);

  const toggleAddon = useCallback((offerId: string) => {
    setState((s) => {
      const isSelected = s.selection.selectedAddonIds.includes(offerId);
      const newAddonIds = isSelected
        ? s.selection.selectedAddonIds.filter((id) => id !== offerId)
        : [...s.selection.selectedAddonIds, offerId];

      // Revalidate after toggle
      const newBase = birthdayOffers.find((o) => o.id === s.selection.selectedBaseId) || null;
      const conflicts = revalidateAddons(
        newAddonIds,
        birthdayOffers,
        newBase,
        s.quiz.placeType
      );

      return {
        ...s,
        selection: {
          ...s.selection,
          selectedAddonIds: newAddonIds,
        },
        validation: {
          conflicts,
        },
      };
    });
  }, []);

  const removeSelectedOffer = useCallback((offerId: string) => {
    setState((s) => {
      // If removing base, clear it
      if (s.selection.selectedBaseId === offerId) {
        return {
          ...s,
          selection: {
            ...s.selection,
            selectedBaseId: null,
          },
          validation: {
            conflicts: [], // Clear conflicts when base removed
          },
        };
      }

      // Otherwise remove from addons
      const newAddonIds = s.selection.selectedAddonIds.filter((id) => id !== offerId);
      
      // Revalidate remaining addons
      const newBase = birthdayOffers.find((o) => o.id === s.selection.selectedBaseId) || null;
      const conflicts = revalidateAddons(
        newAddonIds,
        birthdayOffers,
        newBase,
        s.quiz.placeType
      );

      return {
        ...s,
        selection: {
          ...s.selection,
          selectedAddonIds: newAddonIds,
        },
        validation: {
          conflicts,
        },
      };
    });
  }, []);

  const revalidateSelection = useCallback(() => {
    setState((s) => {
      const newBase = birthdayOffers.find((o) => o.id === s.selection.selectedBaseId) || null;
      const conflicts = revalidateAddons(
        s.selection.selectedAddonIds,
        birthdayOffers,
        newBase,
        s.quiz.placeType
      );

      return {
        ...s,
        validation: {
          conflicts,
        },
      };
    });
  }, []);

  // ─── Navigation actions ────────────────────────────────────────────────────

  const goToStep = useCallback((step: BuilderStep) => {
    setState((s) => ({
      ...s,
      ui: { ...s.ui, currentStep: step },
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState((s) => {
      const currentIndex = BUILDER_STEP_ORDER.indexOf(s.ui.currentStep);
      const nextIndex = Math.min(currentIndex + 1, BUILDER_STEP_ORDER.length - 1);
      return {
        ...s,
        ui: { ...s.ui, currentStep: BUILDER_STEP_ORDER[nextIndex] },
      };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState((s) => {
      const currentIndex = BUILDER_STEP_ORDER.indexOf(s.ui.currentStep);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return {
        ...s,
        ui: { ...s.ui, currentStep: BUILDER_STEP_ORDER[prevIndex] },
      };
    });
  }, []);

  const resetBuilder = useCallback(() => {
    setState(JSON.parse(JSON.stringify(initialState)) as BirthdayBuilderState);
  }, []);

  /** Полная подмена состояния (восстановление из localStorage и т.п.) */
  const replaceState = useCallback((next: BirthdayBuilderState) => {
    const copy = JSON.parse(JSON.stringify(next)) as BirthdayBuilderState;
    setState(mergeLoadedState(copy));
  }, []);

  const setPartyPlanning = useCallback((partial: Partial<PartyPlanning>) => {
    setState((s) => ({
      ...s,
      partyPlanning: { ...s.partyPlanning, ...partial },
    }));
  }, []);

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    // State
    state,

    // Derived
    selectedBase,
    selectedAddons,
    allSelectedOffers,
    hasValidBase,

    // Quiz actions
    setBasics,
    setPartyForChild,
    applyProfileChildToScenario,
    confirmManualScenarioAfterLogin,
    setPlaceType,
    
    // Selection actions
    selectBase,
    replaceBase,
    toggleAddon,
    removeSelectedOffer,
    revalidateSelection,
    
    // Navigation
    goToStep,
    nextStep,
    prevStep,
    resetBuilder,
    replaceState,
    setPartyPlanning,
  };
}
