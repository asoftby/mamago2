"use client";

import { Fragment, useMemo } from "react";
import { EventCard, activityMockToEventCard, EVENT_CARD_SHELL } from "@/components/events";
import { JournalCard } from "@/components/content-cards/JournalCard";
import { OfferCard } from "@/components/offers/OfferCard";
import { RouteCard } from "@/components/routes/RouteCard";
import { CityHomeSection } from "@/features/city-home/components/CityHomeSection";
import { HorizontalCardRow } from "@/features/city-home/components/HorizontalCardRow";
import { CityHomeAllLink, HomeCarouselHeading } from "@/features/city-home/components/SectionHeader";
import { useCity } from "@/contexts/CityContext";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { getCityLocativePhrase, getCityNominativeName } from "@/lib/city/cityDisplayNames";
import { formatRuShortDayMonth, formatRuShortDayMonthRange } from "@/lib/formatters/date";
import { formatPublicCardPrice } from "@/domain/pricing/publicCardPrice";
import { getActivityFormatLabel } from "@/domain/activities/activity-format";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { formatCardAge } from "@/lib/discovery/formatCardAge";
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
import { rankHomeByAudience, homeAudienceSections } from "@/features/city-home/lib/rankHomeByAudience";
import { SoftAudienceNotice } from "@/features/city-home/components/SoftAudienceNotice";
import { HomeJournalCategoryChips } from "@/features/city-home/components/HomeJournalCategoryChips";
import { HomeSectionQuickChips } from "@/features/city-home/components/HomeSectionQuickChips";
import type { CityBlogCategory } from "@/server/article/cityBlogCategories";

const cardShell = EVENT_CARD_SHELL;
const kudaCardShell = EVENT_CARD_SHELL;
const HOME_PERSONALIZED_PREVIEW_TAKE = 8;
/** Оболочка ширины карточки статьи — тот же ритм, что у ленты «Куда», но 5 карточек в ряду на desktop. */
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
      rankHomeByAudience(activities, {
        personas: family?.personas ?? [],
        selectedPersonaIds: family?.selectedPersonaIds ?? [],
        manualAgeRanges: applied.age,
      }, activity => ({ ageFrom: activity.ageFrom, ageTo: activity.ageTo, agePolicy: activity.agePolicy }))
        .slice(0, HOME_PERSONALIZED_PREVIEW_TAKE),
    [activities, family?.personas, family?.selectedPersonaIds, applied.age],
  );

  const eventsHref = appendCityQuery(`/${citySlug}/events`);
  const eventsLabel = "[все события]";

  if (preview.length === 0) {
    return (
      <CityHomeSection
        className="pt-[5px]" innerClassName="pt-[10px]"
        title={title}
        titleCitySlug={citySlug}
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
      className="pt-[5px]" innerClassName="pt-[10px]"
      title={title}
      titleCitySlug={citySlug}
      hideHeader
    >
      <HorizontalCardRow
        headerTitle={<HomeCarouselHeading title={title} />}
        navLeading={<CityHomeAllLink href={eventsHref} label={eventsLabel} />}
      >
        {preview.map((activity, index) => (
          <div key={activity.id} className={kudaCardShell}>
            <AnalyticsCardViewTracker entityType="EVENT" entityId={activity.id} vertical="CITY" citySlug={citySlug}
              threshold={0.5} dwellMs={1000}
              meta={{ section: "afisha", isPromoted: activity.isPromoted ?? false, crossRegionReason: activity.crossRegionReason ?? null, exposureId: activity.exposureId ?? null }}>
              <EventCard
                {...activityMockToEventCard(activity, citySlug)}
                imagePriority={index < 4}
              />
            </AnalyticsCardViewTracker>
          </div>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}

export function CityHomeClassesSection({
  cityName,
  activities,
  classChips,
  mode,
}: {
  cityName: string;
  activities: ActivityMock[];
  classChips: Array<{ slug: string; title: string }>;
  mode: "local" | "nearby" | "empty";
}) {
  const { appendCityQuery, citySlug } = useCity();
  const family = useFamilyPersona();
  const { applied } = useDiscoveryFilters();
  const sections = useMemo(() => homeAudienceSections(activities, {
    personas: family?.personas ?? [], selectedPersonaIds: family?.selectedPersonaIds ?? [],
    manualAgeRanges: applied.age,
  }, activity => ({ ageFrom: activity.ageFrom, ageTo: activity.ageTo, agePolicy: activity.agePolicy })),
  [activities, family?.personas, family?.selectedPersonaIds, applied.age]);
  const preview = [...sections.primary, ...sections.alternatives].slice(0, 12);

  if (mode === "empty") {
    return null;
  }

  return (
    <CityHomeSection
      title={mode === "local" ? `Занятия ${getCityLocativePhrase(citySlug)}` : "Занятия рядом"}
      subtitle={
        mode === "nearby" ? `В ${cityName} пока немного вариантов — посмотрите рядом` : undefined
      }
      hideHeader
    >
      <HorizontalCardRow
        headerTitle={<HomeCarouselHeading title={mode === "local" ? `Занятия ${getCityLocativePhrase(citySlug)}` : "Занятия рядом"} subtitle={mode === "nearby" ? `В ${cityName} пока немного вариантов — посмотрите рядом` : null} />}
        underHeader={<HomeSectionQuickChips label="Категории занятий" chips={classChips.map(chip => ({ label: chip.title, href: `/${citySlug}/classes/${chip.slug}` }))} />}
        navLeading={
          <CityHomeAllLink
            href={appendCityQuery(`/${citySlug}/classes`)}
            label="[все занятия]"
          />
        }
      >
        {sections.active && preview.length === 0 && <SoftAudienceNotice noAlternatives actionHref={appendCityQuery(`/${citySlug}/classes`)} actionLabel="Занятия" />}
        {sections.active && sections.primary.length === 0 && preview.length > 0 && <SoftAudienceNotice label="занятия" />}
        {preview.map((activity, index) => {
          const href =
            activity.href ??
            publicActivityPath(activity.id, activity.citySlug ?? citySlug, activity.slug);
          const dateRange = activity.dateStart
            ? formatRuShortDayMonthRange(activity.dateStart, activity.dateEnd ?? null)
            : undefined;
          const ageLabel = formatCardAge(activity.ageFrom, activity.ageTo);
          const dateLabel = [ageLabel, dateRange].filter(Boolean).join(" · ");
          const priceLabel = formatPublicCardPrice({ priceMode: activity.priceMode, priceFrom: activity.priceMin, priceTo: activity.priceMax, currency: activity.currency }) ?? undefined;
          return (
            <Fragment key={activity.id}>
              {sections.active && sections.primary.length > 0 && sections.alternatives.length > 0 && index === sections.primary.length && <SoftAudienceNotice label="занятия" afterMatches />}
            <div className={cardShell + " flex flex-col"}>
              <AnalyticsCardViewTracker
                entityType="OFFER"
                entityId={activity.id}
                vertical="CITY"
                citySlug={activity.citySlug ?? citySlug}
                meta={{ section: "classes", isPromoted: activity.isPromoted ?? false, crossRegionReason: activity.crossRegionReason ?? null, exposureId: activity.exposureId ?? null }}
              >
                <OfferCard
                  isPromoted={activity.isPromoted}
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
              {activity.citySlug && activity.citySlug !== citySlug && <p className="pt-2 text-xs text-muted-foreground">
                {getCityNominativeName(activity.citySlug)}
              </p>}
            </div>
            </Fragment>
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
  const family = useFamilyPersona();
  const { applied } = useDiscoveryFilters();
  const sections = useMemo(() => homeAudienceSections(routes, {
    personas: family?.personas ?? [], selectedPersonaIds: family?.selectedPersonaIds ?? [],
    manualAgeRanges: applied.age,
  }, route => ({ ageFrom: null, ageTo: null, ageTags: route.ageTags })),
  [routes, family?.personas, family?.selectedPersonaIds, applied.age]);
  const preview = [...sections.primary, ...sections.alternatives].slice(0, 12);

  if (mode === "empty") {
    return null;
  }

  return (
    <CityHomeSection
      title={mode === "local" ? `Маршруты ${getCityLocativePhrase(citySlug)}` : "Маршруты рядом"}
      subtitle={mode === "nearby" ? "Подобрали маршруты недалеко от вас" : undefined}
      hideHeader
    >
      <HorizontalCardRow
        headerTitle={<HomeCarouselHeading title={mode === "local" ? `Маршруты ${getCityLocativePhrase(citySlug)}` : "Маршруты рядом"} subtitle={mode === "nearby" ? "Подобрали маршруты недалеко от вас" : null} />}
        navLeading={
          <CityHomeAllLink
            href={appendCityQuery(`/${citySlug}/routes`)}
            label="[все маршруты]"
          />
        }
      >
        {sections.active && preview.length === 0 && <SoftAudienceNotice noAlternatives />}
        {sections.active && sections.primary.length === 0 && preview.length > 0 && <SoftAudienceNotice label="маршруты" />}
        {preview.map((route, index) => (
          <Fragment key={route.id}>
            {sections.active && sections.primary.length > 0 && sections.alternatives.length > 0 && index === sections.primary.length && <SoftAudienceNotice label="маршруты" afterMatches />}
          <div className={cardShell}>
            <RouteCard route={route} homeCard />
          </div>
          </Fragment>
        ))}
      </HorizontalCardRow>
    </CityHomeSection>
  );
}

export function CityHomeJournalSection({
  articles,
  categories,
}: {
  articles: CityHomeJournalArticle[];
  categories: CityBlogCategory[];
}) {
  const { appendCityQuery, citySlug } = useCity();

  const visibleArticles = articles.filter((a) => !a.isBreakingNews);
  const saveStatuses = useArticleSaveStatusBatch(visibleArticles.map((a) => a.id));

  if (visibleArticles.length === 0) {
    return null;
  }

  const blogHref = appendCityQuery(`/${citySlug}/blog`);
  const blogLabel = "[все статьи и обзоры]";
  const liveCategories = categories.length > 0 ? categories : Array.from(
    new Map(visibleArticles.filter(article => article.category).map(article => [article.category!.slug, {
      id: article.category!.id,
      slug: article.category!.slug,
      name: article.category!.name,
      thumbnailUrl: article.coverImageUrl,
      hasNewArticle: false,
    }])).values(),
  );

  return (
    <section aria-label="Статьи и обзоры">
      <HorizontalCardRow
        headerTitle={<HomeCarouselHeading title="Статьи и обзоры" />}
        navLeading={<CityHomeAllLink href={blogHref} label={blogLabel} />}
        underHeader={<HomeJournalCategoryChips citySlug={citySlug} categories={liveCategories} />}
      >
        {visibleArticles.map((a, index) => (
          <div key={a.slug} className={cn(cardShell, "relative")}>
          <AnalyticsCardViewTracker
            entityType="ARTICLE"
            entityId={a.id}
            vertical="CITY"
            citySlug={citySlug}
            meta={{ section: "journal", position: index }}
          >
            <JournalCard href={a.href} title={a.title} imageUrl={a.coverImageUrl}
              categoryLabel={a.category?.name} geographyLabel={a.geographyLabel} readTime={a.readTime} tone={index} homeCard />
          </AnalyticsCardViewTracker>
            {/* Save action sits over the cover, outside the navigation link. */}
            <div className="pointer-events-none absolute right-3 top-3 z-10">
              <div className="pointer-events-auto">
                  <ArticleSaveHeart
                    articleId={a.id}
                    articleTitle={a.title}
                    coverImageUrl={a.coverImageUrl}
                    initialStatus={saveStatuses[a.id]}
                    skipOwnFetch
                    source="city-home-journal-card"
                    className="h-11 w-11 bg-[rgba(250,247,241,0.82)] shadow-[0_1px_4px_rgba(20,18,16,0.10)] backdrop-blur-[6px] sm:h-8 sm:w-8"
                    iconClassName="h-5 w-5 sm:h-4 sm:w-4"
                  />
              </div>
            </div>
          </div>
        ))}
      </HorizontalCardRow>
    </section>
  );
}
