"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Calendar, Users } from "lucide-react";
import { SaveToPlanModal } from "@/components/activity/SaveToPlanModal";
import type { IdeaItem } from "./types";

const TYPE_LABELS: Record<IdeaItem["activity"]["type"], string> = {
  EVENT: "Событие",
  PLACE: "Место",
  ROUTE: "Маршрут",
  OFFER: "Предложение",
};

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

  const dateLabel = activity.dateStart
    ? `${formatDate(activity.dateStart)}${activity.dateEnd && activity.dateEnd !== activity.dateStart ? ` — ${formatDate(activity.dateEnd)}` : ""}`
    : null;

  return (
    <>
      <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden flex flex-col">
        {/* Image */}
        <div className="relative aspect-[4/3] bg-neutral-100 shrink-0">
          {activity.coverImageUrl ? (
            <Image
              src={activity.coverImageUrl}
              alt={activity.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-300 text-3xl">
              🎯
            </div>
          )}
          {/* Type badge */}
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium text-neutral-700">
            {TYPE_LABELS[activity.type]}
          </span>
          {/* Planned badge */}
          {idea.isPlanned && (
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-green-500 text-white text-xs font-medium">
              В плане
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-4 gap-3">
          <h3 className="text-sm font-semibold text-neutral-900 leading-snug line-clamp-2">
            {activity.title}
          </h3>

          {/* Meta */}
          <div className="flex flex-col gap-1">
            {activity.city && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{activity.city}</span>
              </div>
            )}
            {activity.ageRange && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>{activity.ageRange}</span>
              </div>
            )}
            {dateLabel && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>{dateLabel}</span>
              </div>
            )}
          </div>

          {/* Planned date */}
          {idea.isPlanned && idea.plannedDate && (
            <p className="text-xs text-green-600 font-medium">
              Запланировано на{" "}
              {new Date(idea.plannedDate).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
              })}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-auto pt-1">
            <button
              onClick={() => setModalOpen(true)}
              className="flex-1 h-9 rounded-xl bg-neutral-900 hover:bg-neutral-700 text-white text-xs font-medium transition-colors"
            >
              {idea.isPlanned ? "Изменить дату" : "Запланировать"}
            </button>
            <Link
              href={`/activities/${activity.id}`}
              className="h-9 px-3 rounded-xl border border-neutral-200 hover:border-neutral-400 text-xs font-medium text-neutral-700 flex items-center transition-colors"
            >
              Открыть
            </Link>
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
