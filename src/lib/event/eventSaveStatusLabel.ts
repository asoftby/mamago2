import { formatPlanDateShort } from "@/lib/event/eventActionState";

/** Distinguishes a saved idea from a dated plan item in event CTAs. */
export function getEventSaveStatusLabel(status: {
  inPlan: boolean;
  isIdea: boolean;
  planDate?: string | null;
}): string | null {
  if (status.inPlan && status.planDate) {
    return `В плане на ${formatPlanDateShort(status.planDate)}`;
  }
  if (status.inPlan && status.isIdea) return "В плане и идеях";
  if (status.inPlan) return "В плане";
  if (status.isIdea) return "В идеях";
  return null;
}
