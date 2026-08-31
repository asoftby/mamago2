import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { StoriesSection } from "@/features/stories/components/StoriesSection";
import { CityHomeBirthdayCta } from "@/features/city-home/components/CityHomeBirthdayCta";
import { ActivationBannerHost } from "@/features/city-home/components/ActivationBannerHost";
import { getFallbackHeroModel, getHeroContext } from "@/features/hero-weather/lib/get-hero-context";
import { getCityCoordsBySlug, getDefaultBelarusFallbackCoords } from "@/features/hero-weather/lib/belarus-city-coordinates";
import { HeroGreetingShell } from "@/features/hero-weather/ui/HeroGreetingShell";
import {
  CityHomeClassesSection,
  CityHomeJournalSection,
  CityHomeKudaSection,
  CityHomeRoutesSection,
} from "@/features/city-home/components/CityHomeContentRows";
import { getCurrentUser } from "@/lib/auth/server";
import { getKudaDiscoveryFeed } from "@/server/discovery/kudaDiscoveryFeed";
import { listPublicRoutesByCity, listPublicRoutesByCityIds } from "@/server/services/route.service";
import { getCityNominativeName } from "@/lib/city/cityDisplayNames";
import { listCityHomeArticles } from "@/server/article/listCityHomeArticles";
import { listNearbyCities, type NearbyCity } from "@/server/city/listNearbyCities";
import { getClassesDiscoveryFeed } from "@/server/discovery/classesDiscoveryFeed";
import type { PublicRouteCardModel } from "@/components/routes/types";
import { summarizeRouteBudget } from "@/lib/routes/routeBudget";
import { getHomeSectionAvailability } from "@/features/city-home/config/homeSectionAvailability";

export type CityHomePageCity = {
  id: string;
  slug: string;
  name: string;
  centerLat: number | null;
  centerLng: number | null;
  lat: number | null;
  lng: number | null;
};

interface CityHomePageProps {
  city: CityHomePageCity;
}

type HeroPersonaMode = "self" | "guest";

/**
 * Weather is a slow, best-effort external call (Open-Meteo) — it must never
 * hold up the rest of the page. This is rendered inside a Suspense boundary
 * so the deterministic fallback hero (no weather) streams immediately and
 * this swaps in once (and if) the real reading resolves.
 */
async function HeroWeatherSection({
  cityId,
  citySlug,
  cityName,
  cityCenterLat,
  cityCenterLng,
  userName,
  personaMode,
}: {
  cityId: string;
  citySlug: string;
  cityName: string;
  cityCenterLat?: number;
  cityCenterLng?: number;
  userName: string | null;
  personaMode: HeroPersonaMode;
}) {
  const heroModel = await getHeroContext({
    cityId,
    citySlug,
    cityName,
    cityCenterLat,
    cityCenterLng,
    userName,
    personaMode,
  });
  return <HeroGreetingShell initialModel={heroModel} />;
}

export default async function CityHomePage({ city }: CityHomePageProps) {
  const sectionAvailability = getHomeSectionAvailability();
  const cityTimezone =
    getCityCoordsBySlug(city.slug)?.timezone ?? getDefaultBelarusFallbackCoords().timezone;

  // Independent server work starts immediately; nothing here waits on the
  // external weather call (see HeroWeatherSection below).
  const userPromise = getCurrentUser();
  const nearbyCitiesPromise: Promise<NearbyCity[]> =
    sectionAvailability.classes || sectionAvailability.routes
      ? listNearbyCities(city)
      : Promise.resolve([]);
  const localRoutesPromise = sectionAvailability.routes
    ? listPublicRoutesByCity(city.id).catch(() => [])
    : Promise.resolve([]);
  const journalArticlesPromise = listCityHomeArticles(city);
  const localClassesPromise = sectionAvailability.classes
    ? getClassesDiscoveryFeed(city.id, city.slug, { take: 8 }).catch(() => [])
    : Promise.resolve([]);

  const nearbyRoutesPromise = sectionAvailability.routes
    ? nearbyCitiesPromise.then((nearby) =>
        listPublicRoutesByCityIds(nearby.map((c) => c.id)).catch(() => []),
      )
    : Promise.resolve([]);
  const nearbyClassesPromise = sectionAvailability.classes
    ? nearbyCitiesPromise.then((nearby) =>
        Promise.all(
          nearby.map((nearbyCity) =>
            getClassesDiscoveryFeed(nearbyCity.id, nearbyCity.slug, { take: 8 }).catch(() => []),
          ),
        ).then((groups) => groups.flat()),
      )
    : Promise.resolve([]);

  // Kuda ranking wants a weather-shaped bias, but must not block on the real
  // weather fetch. Use the same deterministic fallback (real time-of-day,
  // neutral scenario) that the hero itself uses before weather resolves.
  const kudaPreviewPromise = userPromise.then((user) => {
    const rankingContext = getFallbackHeroModel({
      cityName: city.name,
      personaMode: user ? "self" : "guest",
      citySlug: city.slug,
      timezone: cityTimezone,
    });
    return getKudaDiscoveryFeed(city.id, city.slug, user?.id ?? null, {
      take: 8,
      weather: {
        scenario: rankingContext.weatherDayScenario,
        timeOfDay: rankingContext.timeOfDay,
      },
    });
  });

  const [
    user,
    ,
    kudaPreview,
    localRoutes,
    journalArticles,
    localClasses,
    nearbyRoutes,
    nearbyClasses,
  ] = await Promise.all([
    userPromise,
    nearbyCitiesPromise,
    kudaPreviewPromise,
    localRoutesPromise,
    journalArticlesPromise,
    localClassesPromise,
    nearbyRoutesPromise,
    nearbyClassesPromise,
  ]);

  const personaMode: HeroPersonaMode = user ? "self" : "guest";
  const heroFallbackModel = getFallbackHeroModel({
    cityName: city.name,
    personaMode,
    citySlug: city.slug,
    timezone: cityTimezone,
  });

  const mapRoutePreview = (r: (typeof localRoutes)[number]): PublicRouteCardModel => {
    const budgetSummary = summarizeRouteBudget(r.stops);

    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      ageTags: r.ageTags,
      budgetLevel: r.budgetLevel,
      budgetLabel: budgetSummary.label,
      budgetNote: budgetSummary.note,
      cityName: r.city?.name ?? city.name,
      coverImageUrl:
        r.coverImageUrl ??
        r.stops.find((s) => s.photoUrl)?.photoUrl ??
        "https://images.unsplash.com/photo-1513884923967-4b182ef1671f?q=80&w=1200",
      authorName: r.author?.email?.split("@")[0] ?? null,
      isEditorial: r.authorId === null,
      stopsCount: r.stops.length,
      stops: r.stops.map((s) => ({
        id: s.id,
        order: s.order,
        address: s.place?.title ?? s.customTitle ?? s.address ?? "",
        note: s.note,
        photoUrl: s.photoUrl ?? "",
        lat: s.lat ?? undefined,
        lng: s.lng ?? undefined,
      })),
    };
  };

  const localRoutesPreview = localRoutes.map(mapRoutePreview);
  const nearbyRoutesPreviewDb = nearbyRoutes.map(mapRoutePreview);
  const localRouteItems = localRoutesPreview.slice(0, 6);
  const nearbyRouteItems = nearbyRoutesPreviewDb.slice(0, 6);
  const classesMode = localClasses.length > 0 ? "local" : nearbyClasses.length > 0 ? "nearby" : "empty";
  const routesMode = localRouteItems.length > 0 ? "local" : nearbyRouteItems.length > 0 ? "nearby" : "empty";
  const hasHomeContent =
    kudaPreview.length > 0 ||
    (sectionAvailability.classes && classesMode !== "empty") ||
    (sectionAvailability.routes && routesMode !== "empty") ||
    journalArticles.length > 0;

  return (
    <div className="min-h-screen pb-20">
      <Container className="space-y-10 pt-10">
        <Suspense fallback={<HeroGreetingShell initialModel={heroFallbackModel} />}>
          <HeroWeatherSection
            cityId={city.id}
            citySlug={city.slug}
            cityName={city.name}
            cityCenterLat={city.centerLat ?? city.lat ?? undefined}
            cityCenterLng={city.centerLng ?? city.lng ?? undefined}
            userName={user?.displayName?.trim() || user?.email?.split("@")[0] || null}
            personaMode={personaMode}
          />
        </Suspense>

        <div className="px-1">
          <ActivationBannerHost />
        </div>

        <StoriesSection cityId={city.id} citySlug={city.slug} />

        {!hasHomeContent ? (
          <section className="rounded-3xl border border-dashed bg-muted/30 px-5 py-6 sm:px-6">
            <h2 className="text-xl font-semibold text-foreground">
              В {getCityNominativeName(city.slug)} пока нет опубликованного контента
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Когда в базе появятся опубликованные события, занятия, маршруты или статьи, они
              автоматически отобразятся на главной странице города.
            </p>
          </section>
        ) : null}

        <CityHomeKudaSection activities={kudaPreview} />

        {sectionAvailability.classes ? (
          <CityHomeClassesSection
            cityName={getCityNominativeName(city.slug)}
            activities={classesMode === "local" ? localClasses : nearbyClasses}
            mode={classesMode}
          />
        ) : null}

        {sectionAvailability.birthday ? <CityHomeBirthdayCta /> : null}

        {sectionAvailability.routes ? (
          <CityHomeRoutesSection
            routes={routesMode === "local" ? localRouteItems : nearbyRouteItems}
            mode={routesMode}
          />
        ) : null}

        <CityHomeJournalSection articles={journalArticles} />
      </Container>
    </div>
  );
}
