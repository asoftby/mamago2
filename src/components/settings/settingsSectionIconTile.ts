import {
  BUSINESS_CHROME_SOFT_BG,
  BUSINESS_CHROME_SOFT_FG,
} from "@/components/account/accountDropdownTokens";
import { cn } from "@/lib/utils";

export type SettingsIconTileTone = "neutral" | "business";

/** Section icon tile in settings lists/cards (company status, link rows, email). */
export function settingsSectionIconTileClass(
  tone: SettingsIconTileTone = "neutral",
  size: "sm" | "md" = "md",
) {
  return cn(
    "flex shrink-0 items-center justify-center rounded-xl",
    size === "sm" ? "h-9 w-9" : "h-10 w-10",
    tone === "business" ? BUSINESS_CHROME_SOFT_BG : "bg-neutral-100",
  );
}

export function settingsSectionIconClass(tone: SettingsIconTileTone = "neutral") {
  return cn("h-4 w-4", tone === "business" ? BUSINESS_CHROME_SOFT_FG : "text-neutral-500");
}
