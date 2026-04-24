"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import { WeekCalendar } from "./WeekCalendar";
import { PlanDayList } from "./PlanDayList";
import { PlanProfileCompletionGate } from "./PlanProfileCompletionGate";
import { Button } from "@/components/ui/button";
import { BellRing, ChevronRight } from "lucide-react";
import type { PlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";

export type SerializedPlanItem = {
  id: string;
  date: string;
  startsAt: string | null;
  activityId: string | null;
  title: string | null;
  coverImageUrl: string | null;
  planAvailability?: PlanActivityPublicAvailability;
  activity: {
    id: string;
    slug: string | null;
    title: string;
    type: string;
    coverImageUrl: string | null;
    ageLabel: string | null;
  } | null;
};

type Props = {
  initialItems: SerializedPlanItem[];
  ideaActivityIds: string[];
  childrenAges: number[];
  activeReminder?: {
    id: string;
    title: string;
    body: string;
    ctaLabel: string | null;
    ctaAction: string | null;
    createdAt: string;
    isRead: boolean;
  } | null;
};

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

function PlanReminderBanner({
  reminder,
}: {
  reminder: NonNullable<Props["activeReminder"]>;
}) {
  const href = reminder.ctaAction || "/me/plan";

  return (
    <div className="mb-5 rounded-3xl border border-[#F3D7C8] bg-[#FFF6F1] p-4 shadow-[0_8px_24px_rgba(239,135,89,0.08)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-[#D56F47]">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">{reminder.title}</p>
          <p className="mt-1 text-sm leading-6 text-neutral-600">{reminder.body}</p>
          <div className="mt-3">
            <Button
              asChild
              size="sm"
              className="rounded-full bg-[#EF8759] px-4 text-white hover:bg-[#e67747]"
            >
              <Link href={href} className="inline-flex items-center gap-1.5">
                {reminder.ctaLabel || "Открыть план"}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlanPageClient({ initialItems, activeReminder }: Props) {
  const todayISO = getTodayISO();
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [items, setItems] = useState(initialItems);

  // Build a map of date → items for the week calendar dots
  const itemsByDate = useMemo(() => {
    return items.reduce<Record<string, SerializedPlanItem[]>>((acc, item) => {
      if (!acc[item.date]) acc[item.date] = [];
      acc[item.date].push(item);
      return acc;
    }, {});
  }, [items]);

  const dayItems = itemsByDate[selectedDate] ?? [];

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  return (
    <div className="min-h-screen bg-[#F8F8F7]">
      <PlanProfileCompletionGate />
      <Container className="max-w-2xl py-6 pb-20">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/me"
            className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors inline-flex items-center gap-1"
          >
            ← Профиль
          </Link>
          <h1 className="text-2xl font-bold text-neutral-900 mt-2 leading-tight">Мой план</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Планируйте день и сохраняйте активности на нужные даты
          </p>
        </div>

        {activeReminder ? <PlanReminderBanner reminder={activeReminder} /> : null}

        {/* Week Calendar */}
        <WeekCalendar
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          itemsByDate={itemsByDate}
        />

        {/* Day section */}
        <div className="mt-6">
          <PlanDayList
            date={selectedDate}
            items={dayItems}
            onRemove={handleRemoveItem}
          />
        </div>

      </Container>
    </div>
  );
}
