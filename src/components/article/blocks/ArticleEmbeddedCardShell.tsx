"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { ArrowRight, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { SaveHeart } from "@/features/save/SaveHeart";
import { manrope } from "@/lib/fonts";

/**
 * ArticleEmbeddedCardShell — unified card template for all article product blocks.
 *
 * Layout: horizontal — image LEFT (fixed width), content RIGHT.
 * Actions: 1 primary CTA button + ❤️ overlay (top-right of media, adds to plan).
 */

export interface ArticleEmbeddedCardShellProps {
  href: string;

  // Media
  image?: string;
  imageAlt?: string;
  placeholderIcon?: ReactNode;
  placeholderGradient?: string;
  imagePill?: ReactNode;

  // Content
  typeLabel: string;
  title: string;
  metaItems?: ReactNode[];
  description?: string;

  // CTA
  primaryCta: string;

  // Plan action — if activityId provided, uses full SaveHeart with modal
  activityId?: string;
  onSave?: () => void;

  className?: string;
}

export function ArticleEmbeddedCardShell({
  href,
  image,
  imageAlt,
  placeholderIcon,
  placeholderGradient = "from-slate-100 to-slate-200",
  imagePill,
  typeLabel,
  title,
  metaItems,
  description,
  primaryCta,
  activityId,
  onSave,
  className,
}: ArticleEmbeddedCardShellProps) {
  const [saved, setSaved] = useState(false);
  const [animating, setAnimating] = useState(false);
  const visibleMeta = metaItems?.filter(Boolean) ?? [];

  function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaved((v) => !v);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
    onSave?.();
  }

  return (
    <div className={["article-block not-prose", manrope.className, className].filter(Boolean).join(" ")}>
      <Link href={href} className="group block">
        <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-black/[0.06] hover:shadow-md transition-shadow duration-200">
          <div className="flex flex-row">

            {/* ── Media area ── */}
            <div className="relative w-32 sm:w-40 shrink-0 bg-muted overflow-hidden">
              {image ? (
                <Image
                  src={image}
                  alt={imageAlt ?? title}
                  fill
                  className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${placeholderGradient} flex items-center justify-center`}>
                  {placeholderIcon}
                </div>
              )}

              {/* Image pill — top-left */}
              {imagePill && (
                <div className="absolute top-2.5 left-2.5">{imagePill}</div>
              )}
            </div>

            {/* ── Content ── */}
            <div className="relative flex flex-col justify-between gap-2 p-4 flex-1 min-w-0">

              {/* ❤️ Save to plan — top-right of content area */}
              {activityId ? (
                <div className="absolute top-3 right-3" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <SaveHeart
                    activityId={activityId}
                    activityTitle={title}
                    coverImageUrl={image}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  aria-label={saved ? "Сохранено" : "В план"}
                  className={cn(
                    "absolute top-3 right-3 flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white shadow-sm transition-all hover:scale-105 active:scale-95",
                    saved ? "text-primary" : "text-muted-foreground hover:text-primary"
                  )}
                >
                  <Heart
                    className={cn(
                      "h-5 w-5 transition-all duration-300",
                      saved && "fill-current",
                      animating && "scale-125"
                    )}
                  />
                </button>
              )}

              <span className="inline-flex self-start text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {typeLabel}
              </span>

              <h3
                className="font-semibold text-[0.9375rem] leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 pr-10 -mt-1"
              >
                {title}
              </h3>

              {visibleMeta.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {visibleMeta.map((item, i) => (
                    <span key={i} className="flex items-center gap-x-2">
                      {item}
                      {i < visibleMeta.length - 1 && (
                        <span className="opacity-25 select-none">·</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {description && (
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {description}
                </p>
              )}

              <div className="pt-1 mt-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground">
                  {primaryCta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
