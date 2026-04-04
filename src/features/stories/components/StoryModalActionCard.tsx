"use client";

import Image from "next/image";
import { MapPin, Clock, Tag, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryItem } from "../types/story";

interface StoryModalActionCardProps {
  item: StoryItem;
  storyTitle: string;
  onAddToPlan: () => void;
  onDetails: () => void;
}

export function StoryModalActionCard({
  item,
  storyTitle,
  onAddToPlan,
  onDetails,
}: StoryModalActionCardProps) {
  return (
    <div className="flex flex-col h-full px-6 py-6 gap-0">

      {/* ── Story context label ── */}
      <p className="text-[11px] font-medium tracking-widest uppercase text-neutral-400 mb-4">
        {storyTitle}
      </p>

      {/* ── Business identity ── */}
      {item.businessName && (
        <div className="flex items-center gap-2.5 mb-5">
          {item.businessLogo ? (
            <Image
              src={item.businessLogo}
              alt={item.businessName}
              width={56}
              height={56}
              className="rounded-full object-cover ring-1 ring-neutral-200 shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-[#EF8759]/12 flex items-center justify-center shrink-0">
              <span className="text-[18px] font-bold text-[#EF8759] leading-none">
                {item.businessName[0]}
              </span>
            </div>
          )}
          <span className="text-[13px] font-medium text-neutral-500 leading-tight truncate">
            {item.businessName}
          </span>
        </div>
      )}

      {/* ── Promoted badge ── */}
      {item.isPromoted && (
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-[5px] text-[11px] font-medium text-amber-700">
            <Sparkles className="h-3 w-3 shrink-0" />
            Партнёрская рекомендация
          </span>
        </div>
      )}

      {/* ── Title ── */}
      <h3 className="text-[18px] font-semibold text-neutral-900 leading-snug mb-4">
        {item.title}
      </h3>

      {/* ── Meta ── */}
      <div className="space-y-2 mb-4">
        {item.age && (
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
            <span className="text-[13px] text-neutral-500">{item.age}</span>
          </div>
        )}
        {item.datetime && (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
            <span className="text-[13px] text-neutral-500">{item.datetime}</span>
          </div>
        )}
        {item.location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
            <span className="text-[13px] text-neutral-500">{item.location}</span>
          </div>
        )}
      </div>

      {/* ── Price ── */}
      {item.price && (
        <p className="text-[17px] font-semibold text-neutral-900 mb-1">
          {item.price}
        </p>
      )}

      {/* ── Spacer ── */}
      <div className="flex-1 min-h-[16px]" />

      {/* ── CTAs ── */}
      <div className="space-y-2.5">
        <button
          onClick={onAddToPlan}
          className={cn(
            "w-full h-11 rounded-2xl text-[14px] font-semibold",
            "bg-[#EF8759] text-white",
            "shadow-[0_4px_16px_rgba(239,135,89,0.30)]",
            "hover:bg-[#e8784a] active:scale-[0.98] transition-all",
          )}
        >
          Добавить в план
        </button>
        <button
          onClick={onDetails}
          className={cn(
            "w-full h-11 rounded-2xl text-[14px] font-semibold",
            "bg-neutral-100 text-neutral-600",
            "hover:bg-neutral-150 active:scale-[0.98] transition-all",
          )}
        >
          Подробнее
        </button>
      </div>
    </div>
  );
}
