"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/Container";
import { RouteCard } from "@/components/routes/RouteCard";
import { DiscoveryActivitiesGrid } from "@/components/discovery/DiscoveryActivitiesGrid";
import { Intent } from "@/lib/intent";
import { H1 } from "@/components/ui/typography";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { formatCityTitle } from "@/lib/city/cityDisplayNames";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { whenPresetPageTitleSuffix } from "@/features/filters/discovery/whenLabel";
import { ClassesChipBar } from "./ClassesChipBar";
import type { PublicRouteCardModel } from "@/components/routes/types";
import type { ActivityMock } from "@/types/activity";
import type { BudgetConfig } from "./CityShell";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useOptionalDiscoveryBudgetConfig } from "@/features/filters/discovery/discoveryBudgetContext";

function BirthdayQuickStartBanner({ city }: { city: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#F2D5C4] bg-[#FFF5F0] px-6 py-5 shadow-sm">
      <div className="flex items-center justify-between gap-6">
        {/* Icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="12" width="16" height="9" rx="1.5" fill="#EF8759"/>
            <rect x="5" y="14" width="14" height="1" rx="0.5" fill="white" opacity="0.4"/>
            <rect x="5" y="17" width="14" height="1" rx="0.5" fill="white" opacity="0.4"/>
            <path d="M8 12V10C8 9.5 8 8 8 8C8 8 8.5 6 10 6C10 6 10 7 10 8V12" stroke="#EF8759" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M12 12V8C12 7 12 6 12 6C12 6 12.5 4 14 4C14 4 14 5 14 6V12" stroke="#EF8759" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M16 12V10C16 9.5 16 8 16 8C16 8 16.5 6 18 6C18 6 18 7 18 8V12" stroke="#EF8759" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="10" cy="5" r="1" fill="#FFD700"/>
            <circle cx="14" cy="3" r="1" fill="#FFD700"/>
            <circle cx="18" cy="5" r="1" fill="#FFD700"/>
          </svg>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight text-neutral-900">
            Организовать День Рождения за <span className="text-[#EF8759]">10 минут</span>
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            Площадка, анимация, торт, декор и другие штуковины — в одном конструкторе легко и просто
          </p>
        </div>

        {/* CTA Button */}
        <Link
          href={`/${city}/birthday/make`}
          className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-[#EF8759] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e07848] hover:shadow-md"
        >
          Собрать праздник
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 16 16" 
            fill="none" 
            className="transition-transform group-hover:translate-x-0.5"
          >
            <path 
              d="M6 3L11 8L6 13" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}

interface CityDiscoveryShellProps {
  city: string;
  intent: Intent;
  routesData?: PublicRouteCardModel[];
  /** Лента «Куда пойти»: только данные с сервера (БД) */
  discoveryActivities?: ActivityMock[];
  classChips?: Array<{ id: string; title: string; slug: string }>;
  activeClassChipSlug?: string;
  /** Конфигурация бюджетного фильтра; null = фильтр выключен в админке. */
  budgetConfig?: BudgetConfig;
}

export function CityDiscoveryShell({
  city,
  intent,
  routesData,
  discoveryActivities,
  classChips,
  activeClassChipSlug,
  budgetConfig,
}: CityDiscoveryShellProps) {
  const { applied } = useDiscoveryFilters();
  const budgetCtx = useOptionalDiscoveryBudgetConfig();
  const intentConfig = DISCOVERY_INTENT_CONFIG[intent];
  const pageTitle =
    formatCityTitle(intentConfig.titleTemplate, city) +
    whenPresetPageTitleSuffix(applied.whenPreset);

  useEffect(() => {
    budgetCtx?.setBudgetConfig(budgetConfig ?? null);
    return () => {
      budgetCtx?.setBudgetConfig(null);
    };
  }, [budgetConfig, budgetCtx]);

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

          <BirthdayQuickStartBanner city={city} />
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
        {intent === "classes" && classChips && activeClassChipSlug ? (
          <ClassesChipBar chips={classChips} activeChipSlug={activeClassChipSlug} />
        ) : null}
        <DiscoveryActivitiesGrid
          activities={discoveryActivities ?? []}
          coverRatio={intent === "classes" ? "1/1" : undefined}
          emptyTitle={
            intent === "classes"
              ? "Пока нет занятий по вашему запросу"
              : undefined
          }
          emptyDescription={
            intent === "classes"
              ? "В этом городе пока нет подходящих опубликованных предложений — или стоит ослабить фильтры."
              : undefined
          }
        />
      </Container>
    </main>
  );
}
