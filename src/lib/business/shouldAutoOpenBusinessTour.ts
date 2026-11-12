import type { BusinessOnboardingSnapshot } from "@/lib/business/onboardingProgress";

/** Auto-open the cabinet tour once: first empty launchpad visit only. */
export function shouldAutoOpenBusinessTour(onboarding: BusinessOnboardingSnapshot): boolean {
  return (
    onboarding.showLaunchpad &&
    !onboarding.startedAt &&
    !onboarding.tourCompleted &&
    !onboarding.tourSkipped &&
    !onboarding.hasAny
  );
}
