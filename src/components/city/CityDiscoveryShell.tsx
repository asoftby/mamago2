"use client";

import { Container } from "@/components/ui/Container";
import { RouteCard } from "@/components/routes/RouteCard";
import { DiscoveryActivitiesGrid } from "@/components/discovery/DiscoveryActivitiesGrid";
import { Intent } from "@/lib/intent";
import { H1 } from "@/components/ui/typography";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { formatCityTitle } from "@/lib/city/cityDisplayNames";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { whenPresetPageTitleSuffix } from "@/features/filters/discovery/whenLabel";
import type { MockRoute } from "@/mocks/routes.mock";
import type { ActivityMock } from "@/mocks/activity.types";
import Link from "next/link";
import { Plus } from "lucide-react";

interface CityDiscoveryShellProps {
  city: string;
  intent: Intent;
  routesData?: MockRoute[];
  /** Лента «Куда пойти»: только данные с сервера (БД) */
  discoveryActivities?: ActivityMock[];
}

export function CityDiscoveryShell({
  city,
  intent,
  routesData,
  discoveryActivities,
}: CityDiscoveryShellProps) {
  const { applied } = useDiscoveryFilters();
  const intentConfig = DISCOVERY_INTENT_CONFIG[intent];
  const pageTitle =
    formatCityTitle(intentConfig.titleTemplate, city) +
    whenPresetPageTitleSuffix(applied.whenPreset);

  // ── Routes intent ──────────────────────────────────────────────────────────
  if (intent === "routes") {
    const routes = routesData ?? [];

    return (
      <main className="min-h-screen bg-white pb-20">
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

  // ── Birthday: CTA block + activities ───────────────────────────────────────
  if (intent === "birthday") {
    return (
      <main className="min-h-screen bg-white pb-20">
        <Container className="pt-10 space-y-6">
          <div className="space-y-4">
            <H1 className="px-1">{pageTitle}</H1>
          </div>

          {/* CTA: Собрать праздник */}
          <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Собрать праздник за 10 минут
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Выберите площадку, развлечения, торт и декор — всё в одном конструкторе
            </p>
            <Link
              href={`/${city}/birthday/make`}
              className="inline-flex items-center justify-center rounded-xl bg-[#EF8759] text-white px-6 py-3 text-sm font-semibold hover:bg-[#e07848] transition-colors"
            >
              Собрать праздник
            </Link>
          </div>

          <DiscoveryActivitiesGrid activities={discoveryActivities ?? []} coverRatio="1/1" />
        </Container>
      </main>
    );
  }

  // ── Default: activities ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white pb-20">
      <Container className="pt-10 space-y-6">
        <div className="space-y-4">
          <H1 className="px-1">{pageTitle}</H1>
        </div>
        <DiscoveryActivitiesGrid
          activities={discoveryActivities ?? []}
          coverRatio={intent === "classes" ? "1/1" : undefined}
        />
      </Container>
    </main>
  );
}