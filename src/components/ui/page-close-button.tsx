"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface PageCloseButtonProps {
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Единый full-page close/back affordance для auth/onboarding экранов.
 * По умолчанию: history.back(), а если истории нет — fallback на href.
 */
export function PageCloseButton({
  href = "/",
  onClick,
  ariaLabel = "Закрыть",
  className,
}: PageCloseButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (onClick) {
      onClick();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(href);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className={cn(
        "absolute top-5 left-5 inline-flex h-11 w-11 items-center justify-center rounded-full",
        "border border-white/70 bg-white/88 text-neutral-500 backdrop-blur-md",
        "shadow-[0_10px_30px_rgba(17,24,39,0.12)]",
        "transition-all duration-200 hover:-translate-y-0.5 hover:text-neutral-900",
        "hover:shadow-[0_14px_36px_rgba(17,24,39,0.16)]",
        "focus:outline-none focus:ring-2 focus:ring-[#EF8759]/30",
        className,
      )}
    >
      <X className="h-5 w-5" aria-hidden />
    </button>
  );
}
