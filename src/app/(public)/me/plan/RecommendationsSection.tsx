"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { SaveToPlanModal } from "@/components/activity/SaveToPlanModal";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import type { SerializedPlanItem } from "./PlanPageClient";
import type { ActivityMock } from "@/types/activity";
import { formatPrice as formatPriceAmount, formatPriceFrom } from "@/lib/formatters/format-price";

type RecommendationCardProps = {
  activity: ActivityMock;
  selectedDate: string;
  onAdded: (item: SerializedPlanItem) => void;
};

function formatPrice(activity: ActivityMock): string {
  if (activity.priceMin === 0) return "Бесплатно";
  if (activity.priceMin) return formatPriceFrom(activity.priceMin);
  return "";
}

function RecommendationCard({ activity, selectedDate, onAdded }: RecommendationCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async (result: SaveToPlanResult) => {
    if (result.action !== "plan") return;
    setSaving(true);
    try {
      const res = await fetch("/api/save/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: activity.id,
          date: result.dateISO,
          title: activity.title,
          coverImageUrl: activity.image,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onAdded({
          id: data.planItem.id,
          date: result.dateISO,
          startsAt: null,
          effectiveStartsAt: null,
          activityId: activity.id,
          title: activity.title,
          coverImageUrl: activity.image,
          planAvailability: "missing_activity",
          activity: null,
        });
        setModalOpen(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const priceLabel = formatPrice(activity);
  const meta = [
    activity.ageFrom !== undefined ? `${activity.ageFrom}+` : null,
    priceLabel || null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <>
      <div className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition-colors">
        <img
          src={activity.image}
          alt={activity.title}
          className="w-12 h-12 rounded-xl object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 leading-tight line-clamp-1">
            {activity.title}
          </p>
          {meta && <p className="text-xs text-neutral-400 mt-0.5">{meta}</p>}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={saving}
          className={cn(
            "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors",
            "bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-40"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Добавить
        </button>
      </div>

      <SaveToPlanModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        scenario={{ kind: "quickdate", title: activity.title }}
        onConfirm={handleConfirm}
      />
    </>
  );
}

type Block = {
  key: string;
  title: string;
  subtitle: string;
  activities: ActivityMock[];
};

type Props = {
  selectedDate: string;
  ideaRecs: ActivityMock[];
  familyRecs: ActivityMock[];
  generalRecs: ActivityMock[];
  onItemAdded: (item: SerializedPlanItem) => void;
};

export function RecommendationsSection({
  selectedDate,
  ideaRecs,
  familyRecs,
  generalRecs,
  onItemAdded,
}: Props) {
  const blocks: Block[] = [
    ...(ideaRecs.length > 0
      ? [
          {
            key: "ideas",
            title: "Из ваших идей",
            subtitle: "Вы уже сохранили это — можно быстро добавить в план",
            activities: ideaRecs,
          },
        ]
      : []),
    {
      key: "family",
      title: "Подходит вашим детям",
      subtitle: "Подобрано по возрасту и интересам",
      activities: familyRecs,
    },
    {
      key: "general",
      title: "Что можно добавить",
      subtitle: "Популярные активности в Минске",
      activities: generalRecs,
    },
  ];

  return (
    <div className="space-y-8">
      {blocks.map((block) => (
        <div key={block.key}>
          <div className="mb-3 px-1">
            <p className="text-sm font-semibold text-neutral-900">{block.title}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{block.subtitle}</p>
          </div>
          <div className="space-y-2">
            {block.activities.map((activity) => (
              <RecommendationCard
                key={activity.id}
                activity={activity}
                selectedDate={selectedDate}
                onAdded={onItemAdded}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
