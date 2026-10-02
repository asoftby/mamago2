"use client";

import { MobileSmartBackButton } from "@/components/shared/MobileSmartBackButton";

type ArticleMobileBackNavigationProps = {
  fallbackHref: string;
};

/**
 * Article mobile back navigation.
 *
 * For now we intentionally keep only the in-flow back button. It scrolls away
 * with the article content; no floating/sticky duplicate is rendered.
 */
export function ArticleMobileBackNavigation({
  fallbackHref,
}: ArticleMobileBackNavigationProps) {
  return (
    <div className="-mt-3 mb-7 md:mt-0 md:mb-0">
      <MobileSmartBackButton fallbackHref={fallbackHref} />
    </div>
  );
}
