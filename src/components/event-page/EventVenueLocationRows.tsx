"use client";

import { cn } from "@/lib/utils";
import type { EventPageVenue } from "@/lib/event/eventPageTypes";
import { formatVenueAddressForPublicDisplay } from "@/lib/event/formatVenueAddressForDisplay";
import { googleDirectionsUrlFromVenue } from "@/lib/maps/googleDirectionsUrl";

const ROW_KEYS: (keyof Pick<
  EventPageVenue,
  "address" | "metro" | "district"
>)[] = ["address", "metro", "district"];

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
  const hasAny = ROW_KEYS.some((k) => Boolean(venue[k]));
  const directionsHref = googleDirectionsUrlFromVenue(venue);
  if (!hasAny && !directionsHref) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        variant === "compact" && "gap-2.5",
        className
      )}
    >
      {ROW_KEYS.map((key) => {
        const raw = venue[key];
        if (!raw) return null;
        const value =
          key === "address"
            ? formatVenueAddressForPublicDisplay(raw)
            : raw;
        if (!value) return null;
        return (
          <div key={key} className="min-w-0">
            <p
              className={cn(
                "text-[14px] leading-snug text-foreground",
                variant === "compact" && "text-[13px]"
              )}
            >
              {value}
            </p>
            {key === "address" && directionsHref ? (
              <a
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "mt-2.5 inline-block w-fit font-medium text-foreground underline decoration-dashed decoration-primary decoration-2 underline-offset-[4px] hover:text-foreground/75",
                  variant === "compact" ? "text-[13px]" : "text-[14px]",
                )}
              >
                Как добраться?
              </a>
            ) : null}
          </div>
        );
      })}
      {directionsHref && !venue.address?.trim() ? (
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "mt-2.5 inline-block w-fit font-medium text-foreground underline decoration-dashed decoration-primary decoration-2 underline-offset-[4px] hover:text-foreground/75",
            variant === "compact" ? "text-[13px]" : "text-[14px]",
          )}
        >
          Как добраться?
        </a>
      ) : null}
    </div>
  );
}
