import type { Role } from "@prisma/client";
import { canFreelyNavigateWizard } from "../shared/canFreelyNavigateWizard";
import type { PlaceWizardMode } from "./types";

/**
 * Single source of truth for `PlaceWizard`'s step-navigation gate, fed
 * into `handleGoToStep`.
 *
 * `edit` mode targets an entity that already exists in full — every step
 * of it was already filled in at some point (or intentionally left
 * blank), so there is nothing to protect by forcing a sequential walk.
 * This applies regardless of the Place's status: a PUBLISHED Place
 * already allowed free navigation, and there is no reason a PENDING or
 * DRAFT Place under staff review should behave differently — sequential
 * gating there only forces extra clicks through "Далее" for no safety
 * benefit. ADMIN and MODERATOR may also navigate freely in `create` mode.
 * Other roles in `create` mode keep the original sequential rule: the entity
 * doesn't exist yet, so a later step may depend on data from an earlier
 * one not having been entered.
 *
 * Deliberately read-only/side-effect-free — never triggers a save,
 * publish, or status change; the caller is responsible for that.
 */
export function canNavigateToPlaceWizardStep(params: {
  mode: PlaceWizardMode;
  role?: Role | null;
  currentStep: number;
  targetStep: number;
  firstStep: number;
  totalSteps: number;
}): boolean {
  const { mode, role, currentStep, targetStep, firstStep, totalSteps } = params;

  if (targetStep < firstStep || targetStep > totalSteps) return false;

  if (canFreelyNavigateWizard(role) || mode === "edit") return true;

  // create: sequential — backward always allowed, forward only by one step.
  return targetStep <= currentStep + 1 || targetStep < currentStep;
}
