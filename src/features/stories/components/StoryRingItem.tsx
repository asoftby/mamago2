"use client";

import { cn } from "@/lib/utils";

interface StoryRingItemProps {
  title: string;
  emoji?: string;
  seen: boolean;
  onClick: () => void;
}

export function StoryRingItem({ title, seen, onClick }: StoryRingItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 shrink-0 group outline-none"
      aria-label={`Открыть: ${title}`}
    >
      {/* Outer ring */}
      <div
        className={cn(
          "relative h-[76px] w-[76px] md:h-[90px] md:w-[90px] rounded-full p-[1.5px] transition-transform duration-150",
          "group-active:scale-[0.93] group-focus-visible:ring-2 group-focus-visible:ring-[#EF8759]/50 group-focus-visible:ring-offset-2",
          seen
            ? "bg-neutral-300/60"
            : [
                "bg-[conic-gradient(from_135deg,_#EF8759,_#f5b08a,_#EF8759,_#e06030,_#EF8759)]",
              ],
        )}
      >
        {/* White gap + inner circle */}
        <div className="h-full w-full rounded-full bg-white p-[2px]">
          <div
            className={cn(
              "h-full w-full rounded-full",
              seen ? "bg-neutral-100" : "bg-[#FFF8F4]",
              "transition-colors duration-150",
              !seen && "group-hover:bg-[#FFF2EA]",
            )}
          />
        </div>
      </div>

      {/* Label */}
      <span
        className={cn(
          "text-[12px] leading-tight text-center max-w-[76px] md:max-w-[90px] line-clamp-1 transition-colors",
          seen ? "font-normal text-neutral-400" : "font-medium text-neutral-700",
        )}
      >
        {title}
      </span>
    </button>
  );
}
