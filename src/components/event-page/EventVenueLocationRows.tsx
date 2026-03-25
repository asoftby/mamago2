"use client";

import { Building2, MapPin, TrainFront } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventPageVenue } from "@/lib/event/eventPageTypes";

const ROWS: {
  key: keyof Pick<EventPageVenue, "address" | "metro" | "district">;
  label: string;
  Icon: LucideIcon;
}[] = [
  { key: "address", label: "Адрес", Icon: MapPin },
  { key: "metro", label: "Метро", Icon: TrainFront },
  { key: "district", label: "Район", Icon: Building2 },
];

export function EventVenueLocationRows({
  venue,
  className,
  variant = "default",
}: {
  venue: EventPageVenue;
  className?: string;
  /** compact — плотнее, для hero-карточки */
  variant?: "default" | "compact";
}) {
  const hasAny = ROWS.some((r) => Boolean(venue[r.key]));
  if (!hasAny) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        variant === "compact" && "gap-2.5",
        className
      )}
    >
      {ROWS.map(({ key, label, Icon }) => {
        const value = venue[key];
        if (!value) return null;
        return (
          <div key={key} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
                variant === "compact" && "size-7"
              )}
            >
              <Icon
                className={cn("size-4", variant === "compact" && "size-3.5")}
              />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-[14px] leading-snug text-foreground",
                  variant === "compact" && "text-[13px]"
                )}
              >
                {value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
