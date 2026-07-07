"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  contentLifecycleBadgeClassName,
  type ContentLifecycleViewModel,
} from "@/lib/contentLifecycle/contentLifecycleViewModel";

type Props = {
  viewModel: ContentLifecycleViewModel;
  className?: string;
  secondary?: Array<{ label: string; className?: string }>;
};

export function ContentLifecycleStatusBadge({
  viewModel,
  className,
  secondary,
}: Props) {
  const primary = viewModel.badges.find((badge) => badge.primary) ?? viewModel.badges[0];

  if (!primary) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Badge
        variant="outline"
        className={cn(
          "font-normal",
          contentLifecycleBadgeClassName(primary.tone),
        )}
        title={viewModel.description}
      >
        {primary.label}
      </Badge>
      {secondary?.map((item) => (
        <span
          key={item.label}
          className={cn(
            "inline-flex items-center text-[12px] leading-none text-muted-foreground",
            item.className,
          )}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
