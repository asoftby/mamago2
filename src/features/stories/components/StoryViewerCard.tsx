"use client";

import Image from "next/image";
import { MapPin, Clock, Tag, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryItem } from "../types/story";

interface StoryViewerCardProps {
  item: StoryItem;
  storyTitle: string;
  onAddToPlan?: () => void;
  onDetails?: () => void;
}

export function StoryViewerCard({
  item,
  storyTitle,
  onAddToPlan,
  onDetails,
}: StoryViewerCardProps) {
  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10" />
      </div>

      {/* Promoted badge */}
      {item.isPromoted && (
        <div className="absolute top-16 right-4 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-1 text-[10px] font-medium text-white/80">
            <Sparkles className="h-3 w-3" />
            Партнёрская рекомендация
          </span>
        </div>
      )}

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6 pt-20">
        {/* Business info */}
        {item.businessName && (
          <div className="flex items-center gap-2 mb-3">
            {item.businessLogo ? (
              <Image
                src={item.businessLogo}
                alt={item.businessName}
                width={24}
                height={24}
                className="rounded-full object-cover ring-1 ring-white/20"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">
                  {item.businessName[0]}
                </span>
              </div>
            )}
            <span className="text-xs text-white/70 font-medium">
              {item.businessName}
            </span>
          </div>
        )}

        {/* Title */}
        <h3 className="text-xl font-semibold text-white leading-snug mb-3 drop-shadow-sm">
          {item.title}
        </h3>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-5">
          {item.age && (
            <span className="inline-flex items-center gap-1 text-xs text-white/75">
              <Tag className="h-3 w-3" />
              {item.age}
            </span>
          )}
          {item.location && (
            <span className="inline-flex items-center gap-1 text-xs text-white/75">
              <MapPin className="h-3 w-3" />
              {item.location}
            </span>
          )}
          {item.datetime && (
            <span className="inline-flex items-center gap-1 text-xs text-white/75">
              <Clock className="h-3 w-3" />
              {item.datetime}
            </span>
          )}
          {item.price && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-white/90">
              {item.price}
            </span>
          )}
        </div>

        {/* CTAs */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToPlan?.();
            }}
            className={cn(
              "flex-1 h-11 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]",
              "bg-[#EF8759] text-white shadow-lg shadow-[#EF8759]/30",
              "hover:bg-[#e8784a]",
            )}
          >
            Добавить в план
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDetails?.();
            }}
            className={cn(
              "h-11 px-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]",
              "bg-white/15 backdrop-blur-sm text-white border border-white/20",
              "hover:bg-white/25",
            )}
          >
            Подробнее
          </button>
        </div>
      </div>
    </div>
  );
}
