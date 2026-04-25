import { cn } from "@/lib/utils";

/** Персиковый pill-CTA в стиле блока «Собрать праздник» на городской главной. */
export function peachPrimaryCtaLinkClassName(className?: string) {
  return cn(
    "group inline-flex shrink-0 items-center justify-center gap-2 rounded-full",
    "border border-[#ffb38a] bg-[linear-gradient(180deg,_#ffb185_0%,_#ff8f61_100%)] px-5 py-3 text-[12px] font-semibold text-white",
    "shadow-[0_16px_30px_rgba(255,146,93,0.34),inset_0_2px_0_rgba(255,255,255,0.42)] transition-all duration-200",
    "hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(255,146,93,0.4),inset_0_2px_0_rgba(255,255,255,0.5)]",
    "sm:px-[30px] sm:py-[15px] sm:text-[15px]",
    className,
  );
}
