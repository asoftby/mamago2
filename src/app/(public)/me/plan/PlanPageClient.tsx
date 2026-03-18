"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/Container";
import { WeekCalendar } from "./WeekCalendar";
import { PlanDayList } from "./PlanDayList";
import { RecommendationsSection } from "./RecommendationsSection";
import { MINSK_ACTIVITIES } from "@/mocks/activities.minsk";

export type SerializedPlanItem = {
  id: string;
  date: string;
  startsAt: string | null;
  activityId: string | null;
  title: string | null;
  coverImageUrl: string | null;
  activity: {
    id: string;
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
};

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

export function PlanPageClient({ initialItems, ideaActivityIds, childrenAges }: Props) {
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

  // Ideas from mock data (in real app: fetch by ideaActivityIds)
  const ideaRecs = useMemo(() => {
    return MINSK_ACTIVITIES.filter((a) => ideaActivityIds.includes(a.id)).slice(0, 4);
  }, [ideaActivityIds]);

  // Family recs: filter by children ages
  const familyRecs = useMemo(() => {
    if (childrenAges.length === 0) return MINSK_ACTIVITIES.slice(0, 4);
    const minAge = Math.min(...childrenAges);
    const maxAge = Math.max(...childrenAges);
    return MINSK_ACTIVITIES.filter(
      (a) => a.ageFrom <= maxAge && a.ageTo >= minAge
    ).slice(0, 4);
  }, [childrenAges]);

  // General recs: just a few from mock, excluding already planned
  const plannedIds = new Set(items.map((i) => i.activityId).filter(Boolean));
  const generalRecs = MINSK_ACTIVITIES.filter((a) => !plannedIds.has(a.id)).slice(0, 4);

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleItemAdded = (newItem: SerializedPlanItem) => {
    setItems((prev) => {
      // Replace if same activityId exists, otherwise add
      const exists = prev.findIndex((i) => i.activityId === newItem.activityId);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = newItem;
        return next;
      }
      return [...prev, newItem];
    });
    setSelectedDate(newItem.date);
  };

  return (
    <div className="min-h-screen bg-[#F8F8F7]">
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

        {/* Recommendations */}
        <div className="mt-8">
          <RecommendationsSection
            selectedDate={selectedDate}
            ideaRecs={ideaRecs}
            familyRecs={familyRecs}
            generalRecs={generalRecs}
            onItemAdded={handleItemAdded}
          />
        </div>
      </Container>
    </div>
  );
}
