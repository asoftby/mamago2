import type { SignalUsageType } from "@prisma/client";

export const SIGNAL_USAGE_TYPE_LABELS: Record<SignalUsageType, string> = {
  PLAN_ADULT_PREFERENCE: "Plan: предпочтения взрослого",
  PLAN_LEISURE_FORMAT: "Plan: формат досуга",
};

export type PlanOnboardingSignalChip = {
  id: string;
  slug: string;
  title: string;
  order: number;
  icon: string | null;
};

export function isSignalUsageType(value: string): value is SignalUsageType {
  return value === "PLAN_ADULT_PREFERENCE" || value === "PLAN_LEISURE_FORMAT";
}
