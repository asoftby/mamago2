"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, Tag, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
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

  return (
    <div className="flex flex-col h-full px-6 py-6 gap-0">

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

      {item.description ? (
        <p className="mt-2 mb-5 whitespace-pre-line text-[15px] leading-[1.6] text-neutral-600 line-clamp-4 md:line-clamp-5">
          {item.description}
        </p>
      ) : null}

      {/* ── Spacer ── */}
      <div className="flex-1 min-h-[16px]" />

      {/* ── Price — anchored immediately above CTA ── */}
      {item.price && (
        <p className="mb-3 text-[17px] font-semibold text-neutral-900">
          {item.price}
        </p>
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
  );
}
