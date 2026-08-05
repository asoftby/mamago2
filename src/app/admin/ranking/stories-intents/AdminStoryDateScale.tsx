"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { WeekCalendarStrip } from "@/features/my-plan/components/WeekCalendarStrip";
import { pluralizeStories } from "./storiesAdminDateScale";

export function AdminStoryDateScale({ selectedDate, counts }: { selectedDate: string; counts: Record<string, number> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const labels = Object.fromEntries(Object.entries(counts).map(([date, count]) => [date, pluralizeStories(count)]));
  const selectDate = (date: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("date", date);
    router.push(`/admin/ranking/stories-intents?${next.toString()}`, { scroll: false });
  };
  return <WeekCalendarStrip selectedDate={selectedDate} onChangeDate={selectDate} plannedCountByDate={counts} countLabelByDate={labels} allowPastDates className="w-full" />;
}
