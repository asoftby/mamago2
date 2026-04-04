"use client";

import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiscoveryIntentTabs } from "@/components/city/DiscoveryIntentTabs";
import { HEADER_CHROME_ICON_BUTTON_CLASS } from "@/components/site/header/headerIconButtonClass";
import type { Intent } from "@/lib/intent";

type MobileLandingHeaderChromeProps = {
  citySlug: string;
  /** Как в `MobileSearchEntry`: активный раздел; на SEO-странице часто `undefined` */
  currentIntent: Intent | null | undefined;
  onSearchClick: () => void;
};

/**
 * Компактный верх для посадочных: лого + табы разделов + лупа (открывает тот же `MobileSearchSheet`).
 */
export function MobileLandingHeaderChrome({
  citySlug,
  currentIntent,
  onSearchClick,
}: MobileLandingHeaderChromeProps) {
  return (
    <div className="flex min-h-[52px] min-w-0 items-center gap-2">
      <Link
        href={`/${citySlug}`}
        className="flex shrink-0 items-center rounded-lg p-0.5 transition-opacity hover:opacity-90"
        aria-label="MamaGo — на главную"
      >
        <Image
          src="/favico_mamago.webp"
          alt=""
          width={100}
          height={100}
          className="h-8 w-auto"
        />
      </Link>
      <div className="min-h-10 min-w-0 flex-1 self-center overflow-hidden">
        <DiscoveryIntentTabs
          city={citySlug}
          currentIntent={currentIntent ?? null}
          variant="airbnb"
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={HEADER_CHROME_ICON_BUTTON_CLASS}
        aria-label="Поиск"
        onClick={onSearchClick}
      >
        <Search className="h-4 w-4" />
      </Button>
    </div>
  );
}
