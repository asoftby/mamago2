"use client";

import { Zap } from "lucide-react";
import { StoryRingItem } from "./StoryRingItem";

interface BreakingNewsRingItemProps {
  title: string;
  seen: boolean;
  onClick: () => void;
  itemCount: number;
  coverImageUrl?: string | null;
}

export function BreakingNewsRingItem({
  title,
  seen,
  onClick,
  itemCount,
  coverImageUrl,
}: BreakingNewsRingItemProps) {
  return (
    <StoryRingItem
      title={title}
      seen={seen}
      onClick={onClick}
      coverImageUrl={coverImageUrl ?? null}
      itemCount={itemCount}
      fallbackContent={
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#EFF6FF] via-[#DBEAFE] to-[#BFDBFE]"
          aria-hidden
        >
          <Zap className="h-8 w-8 text-[#2563EB] md:h-10 md:w-10" strokeWidth={1.75} />
        </div>
      }
    />
  );
}
