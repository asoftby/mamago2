import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Surface } from "@/components/ui/surface";
import { MediaCover } from "@/components/ui/media-cover";
import { Badge } from "@/components/ui/badge";
import { H3, Caption } from "@/components/ui/typography";

type UiActivityCardProps = {
  href: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  badges?: string[];
  meta?: string;
  rating?: number;
  topRight?: React.ReactNode;
  className?: string;
  imageRatio?: string;
};

export function UiActivityCard({
  href,
  title,
  subtitle,
  imageUrl,
  badges = [],
  meta,
  rating,
  topRight,
  className,
  imageRatio = "4/3",
}: UiActivityCardProps) {
  const ratingStr =
    typeof rating === "number"
      ? rating.toFixed(1).replace(".", ",")
      : undefined;
  const metaText = [meta, ratingStr ? `★ ${ratingStr}` : null]
    .filter(Boolean)
    .join(" • ");
  return (
    <Link href={href} className={cn("group block select-none", className)}>
      <MediaCover imageUrl={imageUrl} ratio={imageRatio}>
        {badges?.length > 0 && (
          <div className="absolute top-3 left-3 z-10 flex gap-2">
            {badges.slice(0, 2).map((b, i) => (
              <Badge key={i} className="bg-white/90 text-foreground shadow-sm border-none backdrop-blur-sm px-2.5 py-0.5 text-xs font-medium">
                {b}
              </Badge>
            ))}
          </div>
        )}
        {topRight && (
          <div className="absolute top-3 right-3 z-10">
            {topRight}
          </div>
        )}
      </MediaCover>

      <Surface className="mt-2.5 bg-transparent border-0 shadow-none p-0">
        <div className="flex justify-between items-start gap-2 px-1">
          <H3 as="span" className="text-sm md:text-base transition-colors duration-150 group-hover:text-primary line-clamp-2">
            {title}
          </H3>
        </div>
        {subtitle && <Caption className="px-1">{subtitle}</Caption>}
        {metaText && (
          <Caption className="px-1 text-muted-foreground">
            {metaText}
          </Caption>
        )}
      </Surface>
    </Link>
  );
}
