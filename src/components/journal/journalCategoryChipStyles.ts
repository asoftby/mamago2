import { SECTION_NAV_CHIP_HEIGHT } from "@/components/ui/sectionChipStyles";

/** Same 44px height as event/section chips; thumbnails remain circular on both surfaces. */
export const JOURNAL_CHIP = `inline-flex ${SECTION_NAV_CHIP_HEIGHT} shrink-0 items-center gap-2 rounded-full border pl-1 pr-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary`;
export const JOURNAL_CHIP_THUMB = "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground";
