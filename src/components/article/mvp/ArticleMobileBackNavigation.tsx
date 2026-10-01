"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MobileSmartBackButton } from "@/components/shared/MobileSmartBackButton";
import { useMobileBottomBarHidden } from "@/hooks/useMobileBottomBarHidden";
import { shouldHideMobileBottomNav } from "@/lib/intent";
import { cn } from "@/lib/utils";

type ArticleMobileBackNavigationProps = {
  fallbackHref: string;
};

/**
 * Article-only mobile back navigation.
 *
 * The regular back button stays in the article chrome. Once it scrolls above
 * the viewport, a compact floating duplicate appears above the mobile bottom
 * bar. Both buttons reuse the same smart-back behavior.
 */
export function ArticleMobileBackNavigation({
  fallbackHref,
}: ArticleMobileBackNavigationProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [showFloatingBack, setShowFloatingBack] = useState(false);
  const bottomBarHidden = useMobileBottomBarHidden();

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingBack(
          !entry.isIntersecting && entry.boundingClientRect.bottom <= 0,
        );
      },
      { threshold: [0, 1] },
    );

    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  const hasBottomBar = !shouldHideMobileBottomNav(pathname);
  const isArticlePreview = pathname?.startsWith("/preview/articles/") ?? false;

  return (
    <>
      <div ref={anchorRef} className="-mt-3 mb-7 md:mt-0 md:mb-0">
        <MobileSmartBackButton fallbackHref={fallbackHref} />
      </div>

      {showFloatingBack && !isArticlePreview ? (
        <div
          className={cn(
            "fixed left-4 z-[45] lg:hidden transition-transform duration-200 ease-in-out will-change-transform",
            hasBottomBar
              ? "bottom-[calc(5.75rem+env(safe-area-inset-bottom)+0.75rem)]"
              : "bottom-[max(1rem,env(safe-area-inset-bottom))]",
            hasBottomBar && bottomBarHidden
              ? "translate-y-[calc(5.75rem+env(safe-area-inset-bottom))]"
              : "translate-y-0",
          )}
        >
          <MobileSmartBackButton
            fallbackHref={fallbackHref}
            className={cn(
              "relative overflow-hidden px-4 py-2.5",
              "!border-white/50 !bg-[linear-gradient(135deg,rgba(255,255,255,0.46)_0%,rgba(255,255,255,0.20)_52%,rgba(255,255,255,0.30)_100%)]",
              "!text-gray-900 backdrop-blur-[22px] backdrop-saturate-[1.65]",
              "!shadow-[0_12px_32px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.78),inset_0_-1px_0_rgba(255,255,255,0.20)]",
              "ring-1 ring-black/[0.03]",
              "before:pointer-events-none before:absolute before:inset-[1px] before:rounded-full before:border before:border-white/40 before:content-['']",
              "active:scale-[0.98] active:!bg-white/35",
              "animate-in fade-in slide-in-from-bottom-2 duration-200",
            )}
          />
        </div>
      ) : null}
    </>
  );
}
