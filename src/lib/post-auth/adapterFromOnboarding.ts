import { OnboardingEntryPoint } from "@/lib/onboarding/types";
import type { AuthEntryPoint } from "./types";

/** Временный мост для аналитики и legacy-кода, пока `OnboardingEntryPoint` не удалён. */
export function mapOldEntryPointToPostAuth(entry: OnboardingEntryPoint): AuthEntryPoint {
  switch (entry) {
    case OnboardingEntryPoint.HEADER_PROFILE:
      return "profile";
    case OnboardingEntryPoint.SAVE_EVENT:
      return "save_plan";
    case OnboardingEntryPoint.HEADER_MY_PLAN:
    case OnboardingEntryPoint.MY_PLAN:
      return "my_plan";
    case OnboardingEntryPoint.BIRTHDAY_CONSTRUCTOR:
      return "birthday_constructor";
    default:
      return "profile";
  }
}
