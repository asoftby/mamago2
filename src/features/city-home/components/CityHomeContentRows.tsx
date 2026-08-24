"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EventCard, activityMockToEventCard, EVENT_CARD_SHELL } from "@/components/events";
import { OfferCard } from "@/components/offers/OfferCard";
import { RouteCard } from "@/components/routes/RouteCard";
import { CityHomeSection } from "@/features/city-home/components/CityHomeSection";
import { HorizontalCardRow } from "@/features/city-home/components/HorizontalCardRow";
import { CityHomeAllLink } from "@/features/city-home/components/SectionHeader";
import { useCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import { formatRuShortDayMonth, formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPublicCardPrice } from "@/domain/pricing/publicCardPrice";
import { getActivityFormatLabel } from "@/domain/activities/activity-format";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import type { ActivityMock } from "@/types/activity";
import type { PublicRouteCardModel } from "@/components/routes/types";
import { cn } from "@/lib/utils";
import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { ArticleSaveHeart } from "@/features/save/ArticleSaveHeart";
import { useArticleSaveStatusBatch } from "@/features/save/useArticleSaveStatusBatch";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import {
  buildAudienceLabel,
  buildMainTitle,
} from "@/features/city-home/lib/audiencePersonalization";
import { applyPersonaRanking } from "@/features/city-home/lib/personaRanking";

const cardShell = EVENT_CARD_SHELL;
const kudaCardShell = EVENT_CARD_SHELL;
/** Оболочка ширины карточки статьи — тот же ритм, что у ленты «Куда», но 5 карточек в ряду на desktop. */
const ARTICLE_CARD_SHELL =
  "shrink-0 snap-start w-[44vw] min-w-[160px] max-w-[230px] sm:max-w-[250px] " +
  "lg:w-[calc((100%-6rem)/5)] lg:max-w-none";

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

  const eventsHref = appendCityQuery(`/${citySlug}/events`);
  const eventsLabel = "[все события]";

  if (preview.length === 0) {
    return (
      <CityHomeSection
        className="pt-[5px]"
        title={title}
        actionLabel={eventsLabel}
        actionHref={eventsHref}
        actionInlineText
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
      actionLabel={eventsLabel}
      actionHref={eventsHref}
      actionInlineText
      // На lg ссылка уезжает к стрелкам карусели — скрываем дубль в заголовке
      headerActionClassName="lg:hidden"
    >
      <HorizontalCardRow
        navLeading={
          <CityHomeAllLink
            href={eventsHref}
            label={eventsLabel}
            className="hidden lg:inline-flex"
          />
        }
      >
        {preview.map((activity) => (
          <div key={activity.id} className={kudaCardShell}>
            <EventCard {...activityMockToEventCard(activity, citySlug)} />
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
          const priceLabel = formatPublicCardPrice({ priceMode: activity.priceMode, priceFrom: activity.priceMin, priceTo: activity.priceMax, currency: activity.currency }) ?? undefined;
          return (
            <div key={activity.id} className={cardShell}>
              <AnalyticsCardViewTracker
                entityType="OFFER"
                entityId={activity.id}
                vertical="CITY"
                citySlug={activity.citySlug ?? citySlug}
                meta={{ section: "classes" }}
              >
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
              </AnalyticsCardViewTracker>
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
  const { appendCityQuery, citySlug } = useCity();

  const visibleArticles = articles.filter((a) => !a.isBreakingNews);
  const saveStatuses = useArticleSaveStatusBatch(visibleArticles.map((a) => a.id));

  if (visibleArticles.length === 0) {
    return null;
  }

  const blogHref = appendCityQuery(`/${citySlug}/blog`);
  const blogLabel = "[все статьи и обзоры]";

  return (
    <CityHomeSection
      title="Статьи и обзоры"
      actionLabel={blogLabel}
      actionHref={blogHref}
      actionInlineText
      headerActionClassName="lg:hidden"
    >
      <HorizontalCardRow
        navLeading={
          <CityHomeAllLink
            href={blogHref}
            label={blogLabel}
            className="hidden lg:inline-flex"
          />
        }
      >
        {visibleArticles.map((a, index) => (
          <div key={a.slug} className={cn(ARTICLE_CARD_SHELL, "relative")}>
          <AnalyticsCardViewTracker
            entityType="ARTICLE"
            entityId={a.id}
            vertical="CITY"
            citySlug={citySlug}
            meta={{ section: "journal", position: index }}
          >
            <Link
              href={a.href}
              className="block rounded-2xl bg-white p-3 hover:bg-neutral-50/80 transition-colors group"
            >
              <div
                className={cn(
                  "w-full aspect-square rounded-xl mb-3 overflow-hidden bg-gradient-to-br",
                  [
                    "from-[#F2C8A7] to-[#E89460]",
                    "from-[#CDE3D6] to-[#9CC1AC]",
                    "from-[#F6D567] to-[#E8B935]",
                    "from-[#E6DBC8] to-[#C9BCA0]",
                  ][index % 4],
                )}
              >
                {a.coverImageUrl && (
                  <img
                    src={a.coverImageUrl}
                    alt={a.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="mb-1.5 flex items-center gap-2">
                {a.category && (
                  <p className="min-w-0 truncate font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(20,18,16,0.55)]">
                    {a.category.name}
                  </p>
                )}
                <p className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[11px] text-[rgba(20,18,16,0.55)]">
                  <span aria-hidden="true">~</span>
                  {a.readTime} мин.
                </p>
              </div>
              <p className="line-clamp-3 text-sm font-semibold leading-snug text-neutral-900 transition-colors duration-150 group-hover:text-[#C24E22]">
                {a.title}
              </p>
            </Link>
          </AnalyticsCardViewTracker>
            {/* Heart overlay — mirrors the Link's own padding + cover box so it anchors to the cover, not the outer card */}
            <div className="pointer-events-none absolute inset-0 p-3">
              <div className="relative w-full aspect-square">
                <div className="pointer-events-auto absolute right-3 top-3 z-10">
                  <ArticleSaveHeart
                    articleId={a.id}
                    articleTitle={a.title}
                    coverImageUrl={a.coverImageUrl}
                    initialStatus={saveStatuses[a.id]}
                    skipOwnFetch
                    source="city-home-journal-card"
                    className="h-8 w-8 bg-[rgba(250,247,241,0.82)] shadow-[0_1px_4px_rgba(20,18,16,0.10)] backdrop-blur-[6px]"
                    iconClassName="h-4 w-4"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}
