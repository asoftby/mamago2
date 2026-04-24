"use client";

import { useState } from "react";
import Image from "next/image";
import { SaveToPlanModal } from "@/components/activity/SaveToPlanModal";
import { Caption } from "@/components/ui/typography";
import type { IdeaItem } from "./types";

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

interface Props {
  idea: IdeaItem;
  onPlanned: (date: string) => void;
  onRemove: () => void;
}

export function IdeaCard({ idea, onPlanned, onRemove }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const { activity } = idea;
  const unavailable =
    idea.planAvailability === "business_disabled" ||
    idea.planAvailability === "missing_activity";

  const dateLabel = activity.dateStart
    ? `${formatDate(activity.dateStart)}${activity.dateEnd && activity.dateEnd !== activity.dateStart ? ` — ${formatDate(activity.dateEnd)}` : ""}`
    : null;
  const metaLine = [activity.ageRange, dateLabel, activity.priceLabel]
    .filter((v): v is string => Boolean(v))
    .join(" • ");

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {/* Image */}
        <div className="relative aspect-square bg-neutral-100">
          {activity.coverImageUrl ? (
            <Image
              src={activity.coverImageUrl}
              alt={activity.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-300 text-3xl">
              🎯
            </div>
          )}
          {/* Planned badge */}
          {idea.isPlanned && (
            <span className="absolute top-3 right-3 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
              В плане
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3 p-4">
          <div className="space-y-1 px-1.5 pb-1 pt-2.5">
            <h3 className="line-clamp-2 text-sm font-semibold leading-4.5 text-neutral-900 md:text-[14px]">
              {activity.title}
            </h3>
            {/* Meta — 1:1 with feed card text block rhythm */}
            {metaLine ? (
              <Caption className="line-clamp-1 text-muted-foreground">
                {metaLine}
              </Caption>
            ) : null}
          </div>

          {/* Planned date */}
          {idea.isPlanned && idea.plannedDate && (
            <p className="text-xs font-medium text-primary">
              Запланировано на{" "}
              {new Date(idea.plannedDate).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
              })}
            </p>
          )}

          {/* Actions */}
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setModalOpen(true)}
              disabled={unavailable}
              className="flex-1 h-9 rounded-xl bg-neutral-900 hover:bg-neutral-700 text-white text-xs font-medium transition-colors disabled:opacity-40"
            >
              {idea.isPlanned ? "Изменить дату" : "Запланировать"}
            </button>
            <button
              onClick={onRemove}
              className="h-9 px-3 rounded-xl border border-neutral-200 hover:border-red-200 hover:text-red-500 text-xs font-medium text-neutral-500 flex items-center transition-colors"
            >
              Убрать
            </button>
          </div>
        </div>
      </div>

      <SaveToPlanModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        scenario={{ kind: "quickdate", title: activity.title }}
        onConfirm={(result) => {
          if (result.action === "plan" && result.dateISO) {
            onPlanned(result.dateISO);
          }
        }}
      />
    </>
  );
}
