"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface StoryRingItemProps {
  title: string;
  seen: boolean;
  onClick: () => void;
  /** Single cover URL (legacy / single-item stories) */
  coverImageUrl: string | null;
  /** Number of current unique unseen offers. */
  unseenCount?: number;
  /** First ring: preload for LCP. */
  imagePriority?: boolean;
  /** Optional custom fallback content when there is no cover image. */
  fallbackContent?: ReactNode;
}

/** Single image */
function CoverSingle({
  url,
  priority,
  seen,
}: {
  url: string;
  priority: boolean;
  seen: boolean;
}) {
  return (
    <Image
      src={url}
      alt=""
      fill
      priority={priority}
      sizes="(min-width: 768px) 104px, 87px"
      className={cn("object-cover", seen && "grayscale-[0.65]")}
    />
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const noun = count % 10 === 1 && count % 100 !== 11 ? "новое" : "новых";
  return (
    <span
      className="absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#EF8759] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-white"
    >
      +{count} {noun}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StoryRingItem({
  title,
  seen,
  onClick,
  coverImageUrl,
  unseenCount = 0,
  imagePriority = false,
  fallbackContent,
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
              <CoverSingle url={coverImageUrl} priority={imagePriority} seen={isSeen} />
            ) : (
              fallbackContent ?? (
                <div
                  className="h-full w-full bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200"
                  aria-hidden
                />
              )
            )}
          </div>
        </div>

        {/* Count badge */}
        <CountBadge count={hydrated ? unseenCount : 0} />
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
