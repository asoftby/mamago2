"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
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
import { StepReview } from "./steps/StepReview";
import { useRealBirthdayCatalog } from "../hooks/useRealBirthdayCatalog";
import { matchesBirthdayRequirements } from "../lib/realCatalog";
import {
  catalogPriceSummary, compatibleAddonIds, eligibleAddons, hasValidCatalogAnchor, selectedCatalogOffers,
} from "../lib/catalogSelection";
import { BuilderProgressDots } from "./BuilderProgressDots";
import { BuilderSummaryBar } from "./BuilderSummaryBar";
import type { BuilderStep } from "../types/builder";

const NEXT_LABELS: Partial<Record<BuilderStep, string>> = {
  when: "Далее — для кого",
  who: "Далее — формат",
  format: "Далее — подбор",
  pick: "Далее — обзор",
};

const GUESTS_RANGE: Record<string, { min: number; max: number | null }> = {
  up5: { min: 1, max: 5 }, "5-10": { min: 5, max: 10 },
  "10-15": { min: 10, max: 15 }, "15plus": { min: 15, max: null },
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
      return false; // Checked against the verified published catalog below.
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

  const catalog = useRealBirthdayCatalog(citySlug);
  const maxBudget = state.quiz.budgetGroup === "up300" ? 300
    : state.quiz.budgetGroup === "300-600" ? 600
    : state.quiz.budgetGroup === "600-1000" ? 1000 : null;

  const ageMonths = useMemo(() => {
    const dob = state.quiz.partyForChild?.birthDateIso;
    const partyDate = state.quiz.dateRangeFrom;
    if (!dob || !partyDate) return null;
    const birth = new Date(dob + "T00:00:00Z");
    const party = new Date(partyDate + "T00:00:00Z");
    if (Number.isNaN(birth.valueOf()) || Number.isNaN(party.valueOf())) return null;
    const fullMonths = (party.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
      (party.getUTCMonth() - birth.getUTCMonth());
    return Math.max(0, fullMonths - Number(party.getUTCDate() < birth.getUTCDate()));
  }, [state.quiz.partyForChild?.birthDateIso, state.quiz.dateRangeFrom]);

  const guests = GUESTS_RANGE[state.quiz.guestsGroup ?? ""] ?? null;

  const visibleOffers = useMemo(() => catalog.offers.filter((offer) =>
    matchesBirthdayRequirements(offer, {
      ageMonths, maxBudget: offer.currency === "BYN" ? maxBudget : null,
      childrenMin: guests?.min, childrenMax: guests?.max,
    })),
    [catalog.offers, ageMonths, maxBudget, guests?.min, guests?.max]);

  const validBase = hasValidCatalogAnchor(
    visibleOffers, state.selection.selectedBaseId, state.quiz.placeType,
  );
  const selectedOffers = useMemo(() => {
    if (!validBase) return [];
    const allowedAddonIds = new Set(eligibleAddons(
      visibleOffers, state.selection.selectedBaseId, state.quiz.placeType,
    ).map((offer) => offer.id));
    return selectedCatalogOffers(
      visibleOffers, state.selection.selectedBaseId,
      state.selection.selectedAddonIds.filter((id) => allowedAddonIds.has(id)),
    );
  }, [visibleOffers, state.selection.selectedBaseId, state.selection.selectedAddonIds, state.quiz.placeType, validBase]);

  // Persisted state must not keep add-ons that a replaced base made incompatible.
  const { pruneAddons } = builder;
  useEffect(() => {
    if (catalog.status !== "ready") return;
    const base = state.selection.selectedBaseId;
    const kept = validBase
      ? compatibleAddonIds(visibleOffers, base, state.quiz.placeType, state.selection.selectedAddonIds)
      : [];
    if (kept.length !== state.selection.selectedAddonIds.length) pruneAddons(kept);
  }, [catalog.status, validBase, visibleOffers, state.selection.selectedBaseId,
    state.selection.selectedAddonIds, state.quiz.placeType, pruneAddons]);

  const prices = catalogPriceSummary(selectedOffers);
  const totalPrice = prices.minimumByn;
  const overBudget = maxBudget != null && totalPrice > maxBudget;
  const canNext = currentStep === "pick"
    ? catalog.status === "ready" && validBase
    : currentStep !== "done" && canProceedFromStep(currentStep, state);
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
          paddingBottom: 150, // room for the two-row summary bar on phones
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
          {currentStep === "pick" && (
            <StepPick
              citySlug={citySlug}
              offers={visibleOffers}
              allOfferCount={catalog.offers.length}
              loading={catalog.status === "loading"}
              error={catalog.error}
              onRetry={catalog.retry}
              placeType={state.quiz.placeType}
              selectedBaseId={state.selection.selectedBaseId}
              selectedAddonIds={state.selection.selectedAddonIds}
              onSelectBase={builder.selectBase}
              onToggleAddon={builder.toggleAddon}
            />
          )}
          {currentStep === "done" && <StepReview offers={selectedOffers} />}
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
