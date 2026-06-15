import Link from "next/link";
import { CalendarDays, Heart, ImageIcon, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MediaCover } from "@/components/ui/media-cover";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { cn } from "@/lib/utils";
import type { ActivityCardItem } from "@/features/activities";

type ActivityCardProps = {
  item: ActivityCardItem;
  variant?: "default" | "compact" | "horizontal" | "plan";
  density?: "comfortable" | "compact";
  actions?: React.ReactNode;
  className?: string;
};

function buildStatusChips(
  item: ActivityCardItem,
  variant: "default" | "compact" | "horizontal" | "plan",
): string[] {
  const chips: string[] = [];

  if (item.isPast) chips.push("Прошло");
  else if (item.isPlanned) chips.push("В плане");
  else if (item.isSaved && variant !== "plan") chips.push("В идеях");

  if (item.statusLabel) chips.push(item.statusLabel);

  return chips;
}

function buildMetaLine(item: ActivityCardItem): string[] {
  return [item.dateLabel, item.ageLabel, item.priceLabel].filter(
    (value): value is string => Boolean(value),
  );
}

function buildLocationLine(item: ActivityCardItem): string[] {
  return [item.placeTitle, item.addressLabel].filter(
    (value): value is string => Boolean(value),
  );
}

export function ActivityCard({
  item,
  variant = "default",
  density = "comfortable",
  actions,
  className,
}: ActivityCardProps) {
  const statusChips = buildStatusChips(item, variant);
  const metaLine = buildMetaLine(item);
  const locationLine = buildLocationLine(item);
  const isPlanLike = variant === "plan";
  const isHorizontal = variant === "horizontal";
  const isCompact = density === "compact" || variant === "compact" || isPlanLike;

  const imageRatio =
    variant === "compact"
      ? "4/3"
      : isPlanLike
        ? "16/11"
        : isHorizontal
          ? "4/3"
          : "4/5";
  const cardPadding = isCompact ? "p-3.5 sm:p-4" : "p-4 sm:p-5";
  const topBadge =
    item.badgeLabel ??
    (item.type === "event" ? "Событие" : item.type === "offer" ? "Предложение" : null);

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[30px] border border-[rgba(20,18,16,0.07)] bg-white shadow-[0_18px_40px_rgba(20,18,16,0.06)] transition duration-300 md:hover:-translate-y-1 md:hover:shadow-[0_24px_52px_rgba(20,18,16,0.1)]",
        className,
      )}
    >
      <div className={cn("flex h-full flex-col", cardPadding)}>
        <Link
          href={item.href}
          className="block rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759] focus-visible:ring-offset-2"
        >
          <div className={cn("min-w-0", isHorizontal && "grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]")}>
            <div className="w-full">
              <MediaCover
                imageUrl={item.imageUrl}
                alt={item.title}
                ratio={imageRatio}
                className="rounded-[26px] bg-[#F3EFE7] shadow-none"
              >
                {!item.imageUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#F6F1E8] via-[#EEE6D9] to-[#E8DDCF] text-[#8D8275]">
                    <ImageIcon className="size-8 opacity-60" />
                  </div>
                ) : null}

                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  {topBadge ? (
                    <Badge className="rounded-full border-0 bg-[rgba(255,252,247,0.9)] px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#4B433C] shadow-[0_6px_18px_rgba(20,18,16,0.08)] backdrop-blur-md">
                      {topBadge}
                    </Badge>
                  ) : null}
                </div>

                {item.isSaved ? (
                  <div className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-[rgba(255,248,242,0.94)] text-[#EF8759] shadow-[0_8px_20px_rgba(20,18,16,0.12)] backdrop-blur-md">
                    <Heart className="size-4 fill-current" />
                  </div>
                ) : null}

                {statusChips.length > 0 ? (
                  <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                    {statusChips.map((chip) => (
                      <Badge
                        key={chip}
                        className={cn(
                          "rounded-full border-0 px-3 py-1 text-[11px] font-medium shadow-[0_8px_20px_rgba(20,18,16,0.1)] backdrop-blur-md",
                          chip === "Прошло" && "bg-[rgba(52,48,44,0.72)] text-white",
                          chip === "В плане" && "bg-[rgba(237,248,241,0.94)] text-[#2B7A58]",
                          chip === "В идеях" && "bg-[rgba(255,248,242,0.92)] text-[#C86A3E]",
                          chip !== "Прошло" &&
                            chip !== "В плане" &&
                            chip !== "В идеях" &&
                            "bg-[rgba(255,252,247,0.9)] text-[#4B433C]",
                        )}
                      >
                        {chip}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {item.priceLabel ? (
                  <div className="absolute bottom-3 right-3">
                    <Badge className="rounded-full border-0 bg-[rgba(41,36,31,0.78)] px-3 py-1 font-mono text-[11px] font-medium text-white shadow-[0_10px_24px_rgba(20,18,16,0.12)] backdrop-blur-md">
                      {renderCurrencyText(item.priceLabel, { iconSize: "sm" })}
                    </Badge>
                  </div>
                ) : null}
              </MediaCover>
            </div>

            <div className="min-w-0 space-y-2.5 px-1 pt-3">
              <div className="space-y-1.5">
                {item.categoryLabel ? (
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[rgba(20,18,16,0.48)]">
                    {item.categoryLabel}
                  </div>
                ) : null}

                <h3
                  className={cn(
                    "line-clamp-3 text-balance font-semibold leading-[1.28] tracking-[-0.015em] text-[#141210] transition-colors duration-200 group-hover:text-text-brand-hover",
                    isCompact ? "text-[17px]" : "text-[18px] sm:text-[20px]",
                  )}
                >
                  {item.title}
                </h3>
              </div>

              {metaLine.length > 0 ? (
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-1 font-mono leading-snug text-[rgba(20,18,16,0.55)]",
                    isCompact ? "text-[12px]" : "text-[13px]",
                  )}
                >
                  {item.dateLabel ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {item.dateLabel}
                    </span>
                  ) : null}
                  {metaLine
                    .filter((value) => value !== item.dateLabel && value !== item.priceLabel)
                    .map((value) => (
                      <span key={value}>{value}</span>
                    ))}
                </div>
              ) : null}

              {locationLine.length > 0 ? (
                <div
                  className={cn(
                    "flex items-start gap-1.5 text-[rgba(20,18,16,0.5)]",
                    isCompact ? "text-[12px]" : "text-[13px]",
                  )}
                >
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  <span className="line-clamp-2">{locationLine.join(" · ")}</span>
                </div>
              ) : null}
            </div>
          </div>
        </Link>

        {actions ? (
          <div
            className={cn(
              "mt-auto pt-4",
              isPlanLike && "mt-4 border-t border-[rgba(20,18,16,0.08)] pt-4",
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </article>
  );
}
