import { formatHHMM } from "@/lib/formatters/date";

/** Common, presentation-only fields shared by the plan page and the overlay. */
export function planEntryDisplay(input: {
  title?: string | null;
  activity?: { title?: string | null; coverImageUrl?: string | null } | null;
  coverImageUrl?: string | null;
  effectiveStartsAt?: Date | string | null;
  startsAt?: Date | string | null;
}) {
  const title = input.activity?.title?.trim() || input.title?.trim() || "Запись";
  const poster = input.activity?.coverImageUrl ?? input.coverImageUrl ?? null;
  const startsAt = input.effectiveStartsAt ?? input.startsAt ?? null;
  return {
    title,
    poster,
    time: startsAt ? formatHHMM(startsAt) : null,
  };
}
