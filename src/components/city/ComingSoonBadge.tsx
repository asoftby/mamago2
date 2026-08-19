import { cn } from "@/lib/utils";

interface ComingSoonBadgeProps {
  className?: string;
}

/**
 * Единый бейдж «Скоро» для disabled-пунктов primary navigation
 * (`DiscoveryIntentTabs`, оба варианта: desktop header и mobile landing header).
 */
export function ComingSoonBadge({ className }: ComingSoonBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-muted px-1.5 py-[1px] text-[8px] font-medium normal-case leading-none tracking-normal text-muted-foreground",
        className,
      )}
    >
      Скоро
    </span>
  );
}
