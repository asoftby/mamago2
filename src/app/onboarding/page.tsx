import { redirect } from "next/navigation";

/**
 * Safety alias route for /onboarding
 * Redirects to /business/onboarding to prevent 404s from legacy links
 */
export default function OnboardingAliasPage() {
  redirect("/business/onboarding");
}
