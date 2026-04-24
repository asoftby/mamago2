"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface StoryRingItemProps {
  title: string;
  seen: boolean;
  onClick: () => void;
  /** Remote or same-origin image URL from story mock items; empty → neutral fallback. */
  coverImageUrl: string | null;
  /** First ring: preload for LCP. */
  imagePriority?: boolean;
}

export function StoryRingItem({
  title,
  seen,
  onClick,
  coverImageUrl,
  imagePriority = false,
}: StoryRingItemProps) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const isSeen = hydrated ? seen : false;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 shrink-0 group outline-none"
      aria-label={`Открыть: ${title}`}
    >
      <div
        className={cn(
          "relative h-[87px] w-[87px] md:h-[104px] md:w-[104px] rounded-full p-[2px] transition-transform duration-150",
          "group-active:scale-[0.93] group-focus-visible:ring-2 group-focus-visible:ring-[#EF8759]/50 group-focus-visible:ring-offset-2",
          isSeen ? "bg-neutral-300" : "bg-[#EF8759]",
        )}
      >
        {/* 2px inset between brand ring and cover */}
        <div className="h-full w-full rounded-full bg-white p-[2px]">
          <div
            className={cn(
              "relative h-full w-full overflow-hidden rounded-full",
              isSeen ? "opacity-80" : "opacity-100",
            )}
          >
            {coverImageUrl ? (
              <Image
                src={coverImageUrl}
                alt=""
                fill
                priority={imagePriority}
                sizes="(min-width: 768px) 104px, 87px"
                className={cn("object-cover", isSeen && "grayscale-[0.65]")}
              />
            ) : (
              <div
                className="h-full w-full bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200"
                aria-hidden
              />
            )}
          </div>
        </div>
      </div>

      <span
        className={cn(
          "text-[12px] leading-tight text-center max-w-[87px] md:max-w-[104px] line-clamp-1 transition-colors",
          isSeen ? "font-normal text-neutral-400" : "font-medium text-neutral-700",
        )}
      >
        {title}
      </span>
    </button>
  );
}
