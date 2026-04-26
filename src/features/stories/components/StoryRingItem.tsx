"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface StoryRingItemProps {
  title: string;
  seen: boolean;
  onClick: () => void;
  /** Single cover URL (legacy / single-item stories) */
  coverImageUrl: string | null;
  /** Multiple cover URLs for collage (2–4 images) */
  coverImageUrls?: string[];
  /** Total items count — shows badge if > 1 */
  itemCount?: number;
  /** First ring: preload for LCP. */
  imagePriority?: boolean;
}

// ─── Collage layouts ──────────────────────────────────────────────────────────

/** 2 images: split 50/50 left/right */
function CollageSplit({ urls, priority }: { urls: [string, string]; priority: boolean }) {
  return (
    <div className="h-full w-full flex overflow-hidden rounded-full">
      <div className="relative w-1/2 h-full">
        <Image src={urls[0]} alt="" fill sizes="52px" className="object-cover" priority={priority} />
      </div>
      <div className="relative w-1/2 h-full border-l border-white/30">
        <Image src={urls[1]} alt="" fill sizes="52px" className="object-cover" />
      </div>
    </div>
  );
}

/** 3–4 images: 2×2 grid */
function CollageGrid({ urls }: { urls: string[] }) {
  const cells = urls.slice(0, 4);
  return (
    <div className="h-full w-full grid grid-cols-2 grid-rows-2 overflow-hidden rounded-full gap-[1px]">
      {cells.map((url, i) => (
        <div key={i} className="relative overflow-hidden">
          <Image src={url} alt="" fill sizes="52px" className="object-cover" />
        </div>
      ))}
    </div>
  );
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
  if (count <= 1) return null;
  const label = count > 9 ? "9+" : `+${count - 1}`;
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF8759] px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white"
      aria-label={`${count} событий`}
    >
      {label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StoryRingItem({
  title,
  seen,
  onClick,
  coverImageUrl,
  coverImageUrls,
  itemCount = 1,
  imagePriority = false,
}: StoryRingItemProps) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const isSeen = hydrated ? seen : false;

  // Resolve which cover layout to use
  const validUrls = (coverImageUrls ?? []).filter((u) => u?.trim());
  const useCollage = validUrls.length >= 2;

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
            {useCollage ? (
              validUrls.length === 2 ? (
                <CollageSplit
                  urls={[validUrls[0], validUrls[1]]}
                  priority={imagePriority}
                />
              ) : (
                <CollageGrid urls={validUrls} />
              )
            ) : coverImageUrl ? (
              <CoverSingle url={coverImageUrl} priority={imagePriority} seen={isSeen} />
            ) : (
              <div
                className="h-full w-full bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200"
                aria-hidden
              />
            )}
          </div>
        </div>

        {/* Count badge */}
        <CountBadge count={itemCount} />
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
