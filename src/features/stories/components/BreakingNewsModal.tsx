"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Zap } from "lucide-react";
import type { BreakingNewsItem } from "../lib/listBreakingNews";

interface BreakingNewsModalProps {
  newsItems: BreakingNewsItem[];
  onClose: () => void;
}

function relativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays === 1) return "вчера";
  if (diffDays < 7) return `${diffDays} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function BreakingNewsModal({
  newsItems,
  onClose,
}: BreakingNewsModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // ── scroll lock ───────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  // ── keyboard ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      style={{ background: "rgba(10,10,10,0.72)", backdropFilter: "blur(10px)" }}
      onClick={handleBackdropClick}
    >
      {/* ── Close button ── */}
      <ModalCloseButton
        onClick={onClose}
        className={cn(
          "absolute z-[60]",
          "md:top-6 md:right-6",
          "top-4 right-4",
        )}
      />

      {/* ── Modal body ── */}
      <div
        className={cn(
          "relative overflow-hidden bg-white shadow-2xl",
          // Desktop: centered card
          "md:rounded-3xl md:max-w-[520px] md:w-full md:max-h-[80vh] md:mx-4",
          // Mobile: bottom sheet
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-3xl",
          "max-md:max-h-[92dvh]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-5 py-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900 leading-tight">
              Срочно
            </h2>
            <p className="text-[11px] text-neutral-400 leading-tight">
              Быстрые новости
            </p>
          </div>
        </div>

        {/* ── List ── */}
        <div className="overflow-y-auto max-h-[calc(92dvh-72px)] md:max-h-[calc(80vh-72px)]">
          <div className="divide-y divide-neutral-100">
            {newsItems.map((item, index) => (
              <article
                key={item.id}
                className={cn(
                  "flex gap-4 px-5 py-4 transition-colors",
                  "hover:bg-neutral-50",
                )}
              >
                {/* ── Image (optional) ── */}
                {item.imageUrl && (
                  <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-neutral-100 mt-0.5">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                      priority={index < 2}
                    />
                  </div>
                )}

                {/* ── Content ── */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-900 leading-snug line-clamp-2 mb-1">
                    {item.title}
                  </h3>
                  {item.excerpt && (
                    <p className="text-[13px] text-neutral-500 leading-relaxed line-clamp-2 mb-2">
                      {item.excerpt}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <time className="text-[11px] text-neutral-400 shrink-0">
                      {relativeTime(item.publishedAt)}
                    </time>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700 transition-colors shrink-0"
                      >
                        Подробнее
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          className="h-3.5 w-3.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-neutral-400 shrink-0">
                        Публикация без ссылки
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
