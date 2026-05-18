"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ActivityCard } from "@/components/activity/ActivityCard";
import { OfferCard } from "@/components/offers/OfferCard";
import { RouteCard } from "@/components/routes/RouteCard";
import { CityHomeSection } from "@/features/city-home/components/CityHomeSection";
import { HorizontalCardRow } from "@/features/city-home/components/HorizontalCardRow";
import { useCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import { formatRuShortDayMonth, formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPriceFrom } from "@/lib/formatters/format-price";
import { getActivityFormatLabel } from "@/domain/activities/activity-format";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import type { ActivityMock } from "@/types/activity";
import type { PublicRouteCardModel } from "@/components/routes/types";
import { cn } from "@/lib/utils";
import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import {
  buildAudienceLabel,
  buildMainTitle,
} from "@/features/city-home/lib/audiencePersonalization";
import { applyPersonaRanking } from "@/features/city-home/lib/personaRanking";

const cardShell =
  "shrink-0 snap-start w-[44vw] min-w-[160px] max-w-[230px] sm:max-w-[250px] " +
  "lg:w-[calc((100%-4.5rem)/4)] lg:max-w-none";
const kudaCardShell = cardShell;

function buildKudaSectionTitle(input: {
  citySlug: string;
  whenPreset: "TODAY" | "TOMORROW" | "WEEKEND" | null;
  dateFrom: string | null;
  dateTo: string | null;
}): string {
  const cityPart = getCityLocativePhrase(input.citySlug);

  if (input.whenPreset === "TODAY") {
    return `Куда пойти сегодня ${cityPart}`;
  }

  if (input.whenPreset === "TOMORROW") {
    return `Куда пойти завтра ${cityPart}`;
  }

  if (input.whenPreset === "WEEKEND") {
    return `Куда пойти на выходных ${cityPart}`;
  }

  if (input.dateFrom && input.dateTo) {
    const range = formatRuShortDayMonthRange(input.dateFrom, input.dateTo);
    return range ? `Куда пойти ${range} ${cityPart}` : `Куда пойти ${cityPart}`;
  }

  if (input.dateFrom) {
    const dateLabel = formatRuShortDayMonth(input.dateFrom);
    return dateLabel ? `Куда пойти ${dateLabel} ${cityPart}` : `Куда пойти ${cityPart}`;
  }

  return `Куда пойти ${cityPart}`;
}

export function CityHomeKudaSection({ activities }: { activities: ActivityMock[] }) {
  const { appendCityQuery, citySlug } = useCity();
  const { applied } = useDiscoveryFilters();
  const family = useFamilyPersona();
  const baseTitle = buildKudaSectionTitle({
    citySlug,
    whenPreset: applied.whenPreset,
    dateFrom: applied.dateFrom,
    dateTo: applied.dateTo,
  });
  const audienceLabel = buildAudienceLabel({
    selectedPersonaIds: family?.selectedPersonaIds ?? [],
    personas: family?.personas ?? [],
  });
  const title = buildMainTitle({
    baseTitle,
    audienceLabel,
  });
  const preview = useMemo(
    () =>
      applyPersonaRanking(activities, {
        personas: family?.personas ?? [],
        selectedPersonaIds: family?.selectedPersonaIds ?? [],
      }),
    [activities, family?.personas, family?.selectedPersonaIds],
  );

  if (preview.length === 0) {
    return (
      <CityHomeSection
        className="pt-[5px]"
        title={title}
        actionLabel="Смотреть все"
        actionHref={appendCityQuery(`/${citySlug}/events`)}
        actionIconButton
      >
        <p className="text-sm text-neutral-500 px-1 py-2 leading-relaxed">
          Пока нет опубликованных событий — загляните позже в раздел «Куда пойти».
        </p>
      </CityHomeSection>
    );
  }

  return (
    <CityHomeSection
      className="pt-[5px]"
      title={title}
      actionLabel="Смотреть все"
      actionHref={appendCityQuery(`/${citySlug}/events`)}
      actionIconButton
    >
      <HorizontalCardRow>
        {preview.map((activity) => (
          <div key={activity.id} className={kudaCardShell}>
            <ActivityCard
              activity={activity}
              saveMeta={{
                title: activity.title,
                dateISO: activity.dateStart ?? null,
                dateEndISO: activity.dateEnd ?? null,
                dateLabel: activity.dateStart
                  ? formatRuShortDayMonth(activity.dateStart)
                  : null,
              }}
            />
          </div>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}

export function CityHomeClassesSection({
  cityName,
  activities,
  mode,
}: {
  cityName: string;
  activities: ActivityMock[];
  mode: "local" | "nearby" | "empty";
}) {
  const { appendCityQuery, citySlug } = useCity();
  const family = useFamilyPersona();
  const preview = useMemo(
    () =>
      applyPersonaRanking(activities, {
        personas: family?.personas ?? [],
        selectedPersonaIds: family?.selectedPersonaIds ?? [],
      }),
    [activities, family?.personas, family?.selectedPersonaIds],
  );

  if (mode === "empty" || preview.length === 0) {
    return null;
  }

  return (
    <CityHomeSection
      title={mode === "local" ? `Занятия ${getCityLocativePhrase(citySlug)}` : "Занятия рядом"}
      subtitle={
        mode === "nearby" ? `В ${cityName} пока немного вариантов — посмотрите рядом` : undefined
      }
      actionLabel="Все занятия"
      actionHref={appendCityQuery(`/${citySlug}/classes`)}
      actionIconButton
    >
      <HorizontalCardRow>
        {preview.map((activity) => {
          const href =
            activity.href ??
            publicActivityPath(activity.id, activity.citySlug ?? citySlug, activity.slug);
          const dateRange = activity.dateStart
            ? formatRuShortDayMonthRange(activity.dateStart, activity.dateEnd ?? null)
            : undefined;
          const ageLabel =
            activity.ageFrom != null ? `${activity.ageFrom}+` : undefined;
          const dateLabel = [ageLabel, dateRange].filter(Boolean).join(" · ");
          const priceLabel =
            activity.priceMin === 0
              ? "бесплатно"
              : activity.priceMin != null
                ? formatPriceFrom(activity.priceMin)
                : undefined;
          return (
            <div key={activity.id} className={cardShell}>
              <OfferCard
                id={activity.id}
                title={activity.title}
                href={href}
                imageUrl={activity.image}
                categoryLabel={[
                  activity.badge || null,
                  activity.format ? getActivityFormatLabel(activity.format) : null,
                ].filter(Boolean).join(" · ") || undefined}
                dateLabel={dateLabel || undefined}
                priceLabel={priceLabel}
                saveDateISO={activity.dateStart ?? null}
                saveDateEndISO={activity.dateEnd ?? null}
              />
            </div>
          );
        })}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}

export function CityHomeRoutesSection({
  routes,
  mode,
}: {
  routes: PublicRouteCardModel[];
  mode: "local" | "nearby" | "empty";
}) {
  const { appendCityQuery, citySlug } = useCity();
  const preview = routes;

  if (mode === "empty" || preview.length === 0) {
    return null;
  }

  return (
    <CityHomeSection
      title={mode === "local" ? `Маршруты ${getCityLocativePhrase(citySlug)}` : "Маршруты рядом"}
      subtitle={mode === "nearby" ? "Подобрали маршруты недалеко от вас" : undefined}
      actionLabel="Все маршруты"
      actionHref={appendCityQuery(`/${citySlug}/routes`)}
      actionIconButton
    >
      <HorizontalCardRow>
        {preview.map((route) => (
          <div key={route.id} className={cn(cardShell, "max-w-[260px] sm:max-w-[280px]")}>
            <RouteCard route={route} />
          </div>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}

export function CityHomeJournalSection({
  articles,
}: {
  articles: CityHomeJournalArticle[];
}) {
  const { appendCityQuery } = useCity();

  if (articles.length === 0) {
    return null;
  }

  return (
    <CityHomeSection
      title="Статьи и обзоры"
      actionLabel="В журнал"
      actionHref={appendCityQuery("/blog")}
      actionIconButton
    >
      <HorizontalCardRow className="flex-wrap overflow-visible pe-0 snap-none sm:flex-nowrap sm:overflow-x-auto sm:pe-0 sm:snap-x sm:snap-mandatory">
        {articles.map((a, index) => (
          <Link
            key={a.slug}
            href={`/blog/${a.slug}`}
            className={cn(
              cardShell,
              index === 0
                ? "w-full min-w-0 max-w-none sm:w-[42vw] sm:min-w-[156px] sm:max-w-[240px]"
                : "w-[calc((100%-0.75rem)/2)] min-w-0 max-w-none sm:w-[42vw] sm:min-w-[156px] sm:max-w-[240px]",
              "rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300 hover:bg-neutral-50/80 transition-colors",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              {a.category}
            </p>
            <p className="text-sm font-semibold text-neutral-900 leading-snug line-clamp-3 mt-2">
              {a.title}
            </p>
            {a.subtitle ? (
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{a.subtitle}</p>
            ) : null}
            <p className="text-xs text-neutral-400 mt-3">{a.readTime} мин чтения</p>
          </Link>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}
