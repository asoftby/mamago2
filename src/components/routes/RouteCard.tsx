"use client";

import React, { useState } from "react";
import { RouteCardVisual } from "./RouteCardVisual";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { formatAgeKeysShort } from "@/lib/config/ages";
import type { PublicRouteCardModel } from "@/components/routes/types";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { useAuthMe } from "@/features/birthday/builder/hooks/useAuthMe";
import { SaveActivityFlowAdaptive } from "@/components/activity/SaveActivityFlowAdaptive";
import type { SaveToPlanResult } from "@/components/activity/SaveToPlanModal";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";

type Props = {
  route: PublicRouteCardModel;
  className?: string;
  /** Для аналитики CARD_VIEW (город листинга) */
  analyticsCitySlug?: string;
  /** Match the event-card proportions in city-home horizontal rows. */
  homeCard?: boolean;
};

export function RouteCard({ route, className, analyticsCitySlug = "minsk", homeCard = false }: Props) {
  const [planOpen, setPlanOpen] = useState(false);
  const { isAuthenticated } = useAuthMe();
  const router = useRouter();

  const handlePersist = async (result: SaveToPlanResult) => {
    if (result.action === "cancel") return;
    if (result.action === "plan") {
      const res = await fetch("/api/save/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          routeId: route.id,
          planRouteSlug: route.slug,
          date: result.dateISO,
          title: route.title,
          coverImageUrl: route.coverImageUrl,
        }),
      });
      if (!res.ok) throw new Error("plan_save_failed");
      toast.success("Маршрут добавлен в план", {
        action: { label: "Открыть план", onClick: () => router.push("/?myPlan=open") },
      });
    } else if (result.action === "ideas") {
      const res = await fetch("/api/ideas/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ routeId: route.id, routeSlug: route.slug }),
      });
      if (!res.ok) throw new Error("idea_save_failed");
      toast.success("Маршрут сохранён в идеи");
    }
  };

  const ageLabel = route.ageTags.length > 0 ? formatAgeKeysShort(route.ageTags) : null;

  const meta = [
    route.stopsCount ? `${route.stopsCount} точки` : null,
    ageLabel,
    route.budgetLabel,
  ]
    .filter(Boolean)
    .join(" • ");

  const badges = [
    route.isEditorial ? "от mamaGo" : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <AnalyticsCardViewTracker
        entityType="ROUTE"
        entityId={route.id}
        vertical="CITY"
        citySlug={analyticsCitySlug}
        meta={{ section: "routes" }}
      >
      <div className={cn("group relative select-none", className)}>
        <RouteCardVisual href={`/routes/${route.slug}`} title={route.title} imageUrl={route.coverImageUrl} meta={meta} badges={badges} homeCard={homeCard} />

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
      </AnalyticsCardViewTracker>

      <SaveActivityFlowAdaptive
        open={planOpen}
        onOpenChange={setPlanOpen}
        isAuthenticated={isAuthenticated}
        collectionTarget={{ routeId: route.id }}
        scenario={{ kind: "quickdate", title: route.title }}
        onPersist={handlePersist}
      />
    </>
  );
}
