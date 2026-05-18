"use client";

import { Heart, CalendarPlus, Check, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActivityActionsFeedProps = {
  isSaved?: boolean;
  isPlanned?: boolean;
  className?: string;
};

export function ActivityActionsFeed({
  isSaved = false,
  isPlanned = false,
  className,
}: ActivityActionsFeedProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        variant={isSaved ? "secondary" : "outline"}
        size="sm"
        className="rounded-full"
      >
        {isSaved ? <Bookmark className="size-4" /> : <Heart className="size-4" />}
        {isSaved ? "В идеях" : "В идеи"}
      </Button>
      <Button
        type="button"
        variant={isPlanned ? "secondary" : "outline"}
        size="sm"
        className="rounded-full"
      >
        {isPlanned ? <Check className="size-4" /> : <CalendarPlus className="size-4" />}
        {isPlanned ? "В плане" : "В план"}
      </Button>
    </div>
  );
}
