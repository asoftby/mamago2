"use client";

import { Container } from "@/components/ui/Container";
import { ActivityCard } from "@/components/activity/ActivityCard";
import { RouteCard } from "@/components/routes/RouteCard";
import { MINSK_ACTIVITIES } from "@/mocks/activities.minsk";
import { Intent } from "@/lib/intent";
import { H1 } from "@/components/ui/typography";
import { RefinementFiltersButton } from "@/components/discovery/RefinementFiltersButton";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { formatCityTitle } from "@/lib/city/cityDisplayNames";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import type { MockRoute } from "@/mocks/routes.mock";
import Link from "next/link";
import { Plus } from "lucide-react";

interface CityDiscoveryShellProps {
  city: string;
  intent: Intent;
  routesData?: MockRoute[];
}

export function CityDiscoveryShell({
  city,
  intent,
  routesData,
}: CityDiscoveryShellProps) {
  const intentConfig = DISCOVERY_INTENT_CONFIG[intent];
  const pageTitle = formatCityTitle(intentConfig.titleTemplate, city);
  const filteredActivities = MINSK_ACTIVITIES;

  // ── Routes intent ──────────────────────────────────────────────────────────
  if (intent === "routes") {
    const routes = routesData ?? [];

    return (
      <main className="min-h-screen bg-background pb-20">
        <Container className="pt-6 space-y-6">
          <div className="flex items-start justify-between">
            <H1 className="px-1">{pageTitle}</H1>
            <Link
              href="/routes/new"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Создать
            </Link>
          </div>

          {routes.length === 0 && (
            <p className="text-sm text-neutral-400 px-1">
              Маршрутов пока нет — будьте первым!
            </p>
          )}

          {routes.length > 0 && (
            <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
              {routes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          )}
        </Container>
      </main>
    );
  }

  // ── Default: activities ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background pb-20">
      <Container className="pt-10 space-y-6">
        <div className="space-y-4">
          <H1 className="px-1">{pageTitle}</H1>
          {intentConfig.hasFilters && (
            <div className="py-2 hidden md:block">
              <RefinementFiltersButton intent={intent} />
            </div>
          )}
        </div>
        <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
          {filteredActivities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              saveMeta={{
                title: activity.title,
                dateISO: activity.dateStart ?? null,
                dateLabel: activity.dateStart ? formatRuShortDayMonth(activity.dateStart) : null,
              }}
            />
          ))}
        </div>
      </Container>
    </main>
  );
}