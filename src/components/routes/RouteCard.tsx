"use client";

import React, { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MediaCover } from "@/components/ui/media-cover";
import { Badge } from "@/components/ui/badge";
import { H3, Caption } from "@/components/ui/typography";
import { Heart } from "lucide-react";
import { formatAgeKeysShort } from "@/lib/config/ages";
import { BUDGET_LABELS, type MockRoute } from "@/mocks/routes.mock";
import { AddRouteToPlanSheet } from "./AddRouteToPlanSheet";

type Props = {
  route: MockRoute;
  className?: string;
};

export function RouteCard({ route, className }: Props) {
  const [planOpen, setPlanOpen] = useState(false);

  const ageLabel = route.ageTags.length > 0 ? formatAgeKeysShort(route.ageTags) : null;

  const meta = [
    route.stopsCount ? `${route.stopsCount} точки` : null,
    ageLabel,
    BUDGET_LABELS[route.budgetLevel],
  ]
    .filter(Boolean)
    .join(" • ");

  const badges = [
    route.isEditorial ? "от mamaGo" : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <div className={cn("group relative select-none", className)}>
        <Link href={`/routes/${route.slug}`} className="block">
          <MediaCover imageUrl={route.coverImageUrl} ratio="4/5">
            {badges.length > 0 && (
              <div className="absolute top-3 left-3 z-10 flex gap-2">
                {badges.map((b, i) => (
                  <Badge
                    key={i}
                    className="bg-white/90 text-foreground shadow-sm border-none backdrop-blur-sm px-2.5 py-0.5 text-xs font-medium"
                  >
                    {b}
                  </Badge>
                ))}
              </div>
            )}
          </MediaCover>

          <div className="mt-2.5 px-1">
            <H3
              as="span"
              className="text-sm md:text-base transition-colors duration-150 group-hover:text-primary line-clamp-2"
            >
              {route.title}
            </H3>
            {meta && (
              <Caption className="text-muted-foreground line-clamp-1">
                {meta}
              </Caption>
            )}
          </div>
        </Link>

        {/* Heart action — outside Link to prevent navigation */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={(e) => { e.preventDefault(); setPlanOpen(true); }}
            aria-label="Сохранить"
            className="group flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white shadow-sm transition-all hover:scale-105 active:scale-95 text-muted-foreground hover:text-primary"
          >
            <Heart className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      <AddRouteToPlanSheet
        open={planOpen}
        onOpenChange={setPlanOpen}
        routeTitle={route.title}
        routeSlug={route.slug}
      />
    </>
  );
}
