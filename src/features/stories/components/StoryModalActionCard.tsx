"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, Tag, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import type { StoryItem } from "../types/story";

interface StoryModalActionCardProps {
  item: StoryItem;
  storyTitle: string;
  onClose: () => void;
}

export function StoryModalActionCard({
  item,
  storyTitle,
  onClose,
}: StoryModalActionCardProps) {
  const eyebrow = item.eyebrow ?? storyTitle;
  const hasActionSlot = Boolean(item.price || item.href);

  return (
    <div className={cn("flex flex-col px-6 py-6 gap-0", "md:h-full", "max-md:flex-1 max-md:min-h-0")}>

      {/* ── Scrollable text content — mobile: fills the row above the actions slot ── */}
      <div className={cn("max-md:flex-1 max-md:min-h-0 max-md:overflow-y-auto max-md:overscroll-contain")}>
        {/* ── Story context label ── */}
        <p className="mb-4 text-[11px] font-medium tracking-[0.18em] text-neutral-400">
          {eyebrow}
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
        <h3 className="text-[18px] font-semibold text-neutral-900 leading-snug mb-4 line-clamp-3">
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

        {item.description ? (
          // Truncation is CSS-only (scroll on mobile, desktop card grows) — never clip mid-word via line-clamp.
          <p className="mt-2 mb-5 whitespace-pre-line text-[15px] leading-[1.6] text-neutral-600">
            {item.description}
          </p>
        ) : null}
      </div>

      {/* ── Desktop spacer — pushes price/CTA to the bottom of the fixed-height card.
          Mobile doesn't need it: the scroll wrapper above is already flex-1. ── */}
      <div className="max-md:hidden md:flex-1 md:min-h-[16px]" />

      {/* ── Actions slot — price + CTA. Mobile: shrink-0, capped, safe-area aware. ── */}
      {hasActionSlot && (
        <div
          className={cn(
            "max-md:shrink-0 max-md:pt-3",
            "max-md:max-h-[30%] max-md:overflow-hidden",
            "max-md:pb-[calc(env(safe-area-inset-bottom)+16px)]",
          )}
        >
          {item.price && (
            <div className="mb-3">
              <p className="mb-0.5 text-[11px] font-medium tracking-[0.18em] text-neutral-400">
                Стоимость
              </p>
              <p className="text-[17px] font-semibold text-neutral-900">
                {renderCurrencyText(item.price)}
              </p>
            </div>
          )}

          {item.href ? (
            <Link
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex h-11 w-full items-center justify-center rounded-2xl text-[14px] font-semibold",
                "bg-neutral-100 text-neutral-700",
                "hover:bg-neutral-200 active:scale-[0.98] transition-all",
              )}
            >
              Подробнее
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
