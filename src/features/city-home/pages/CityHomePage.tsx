import { loadHomeEvents } from "@/server/services/recommendations/familyPicks/home";
import { HomeEventsBoundary } from "@/features/city-home/components/HomeEventsBoundary";
import { CityHomeGeneralEvents } from "@/features/city-home/components/CityHomeGeneralEvents";
import { CityHomeSection } from "@/features/city-home/components/CityHomeSection";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { StoriesSection } from "@/features/stories/components/StoriesSection";
import { CityHomeFamilyPicks } from "@/features/city-home/components/CityHomeFamilyPicks";
import { CityHomeBirthdayCta } from "@/features/city-home/components/CityHomeBirthdayCta";
import { CityHomeBirthdayOffers } from "@/features/city-home/components/CityHomeBirthdayOffers";
import { selectHomeBirthdayOffers } from "@/features/city-home/lib/homeBirthdayPreview";
import { getPublicBirthdayCatalog } from "@/server/birthday/catalog.service";
import { ActivationBannerHost } from "@/features/city-home/components/ActivationBannerHost";
import { getFallbackHeroModel, getHeroContext } from "@/features/hero-weather/lib/get-hero-context";
import { getCityCoordsBySlug, getDefaultBelarusFallbackCoords } from "@/features/hero-weather/lib/belarus-city-coordinates";
import { HeroGreetingShell } from "@/features/hero-weather/ui/HeroGreetingShell";
import {
  CityHomeClassesSection,
  CityHomeJournalSection,
  CityHomeRoutesSection,
} from "@/features/city-home/components/CityHomeContentRows";
import { getCurrentUser } from "@/lib/auth/server";
import { listPublicRoutesByCity, listPublicRoutesByCityIds } from "@/server/services/route.service";
import { getCityNominativeName } from "@/lib/city/cityDisplayNames";
import { listCityHomeArticles } from "@/server/article/listCityHomeArticles";
import { listNearbyCities, type NearbyCity } from "@/server/city/listNearbyCities";
import { getClassesDiscoveryFeed } from "@/server/discovery/classesDiscoveryFeed";
import type { PublicRouteCardModel } from "@/components/routes/types";
import { summarizeRouteBudget } from "@/lib/routes/routeBudget";
import { getHomeSectionAvailability } from "@/features/city-home/config/homeSectionAvailability";

const HOME_PERSONALIZATION_CANDIDATE_TAKE = 24;

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
  const birthdayOffersPromise = sectionAvailability.birthday
    ? getPublicBirthdayCatalog(city.slug, 120).then(items => selectHomeBirthdayOffers(items ?? [])).catch(() => [])
    : Promise.resolve([]);
  const localClassesPromise = sectionAvailability.classes
    ? getClassesDiscoveryFeed(city.id, city.slug, {
        take: HOME_PERSONALIZATION_CANDIDATE_TAKE, productTypes: ["REGULAR_ACTIVITY"],
      }).catch(() => [])
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
            getClassesDiscoveryFeed(nearbyCity.id, nearbyCity.slug, {
              take: HOME_PERSONALIZATION_CANDIDATE_TAKE, productTypes: ["REGULAR_ACTIVITY"],
            }).catch(() => []),
          ),
        ).then((groups) => groups.flat()),
      )
    : Promise.resolve([]);

  const eventsPromise = userPromise.then(user => loadHomeEvents(user?.id ?? null, city.id, city.slug))
    .catch(() => ({ mode: "error" as const, actorId: null }));

  const [
    user,
    ,
    events,
    localRoutes,
    journalArticles,
    birthdayOffers,
    localClasses,
    nearbyRoutes,
    nearbyClasses,
  ] = await Promise.all([
    userPromise,
    nearbyCitiesPromise,
    eventsPromise,
    localRoutesPromise,
    journalArticlesPromise,
    birthdayOffersPromise,
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

        <StoriesSection cityId={city.id} citySlug={city.slug} />

        <div className="px-1">
          <ActivationBannerHost />
        </div>

        {events.mode === "error" ? <CityHomeSection title="Мероприятия для семьи"><p role="alert">Не удалось проверить профиль. Обновите страницу, чтобы повторить.</p></CityHomeSection> :
          <HomeEventsBoundary key={`${events.actorId}:${city.slug}:${events.mode}`} actorId={events.actorId} citySlug={city.slug}>
            {events.mode === "personal" ? <CityHomeFamilyPicks citySlug={city.slug} initialContext={events.context} /> :
              <CityHomeGeneralEvents activities={events.activities} citySlug={city.slug}
                periodLabel={events.periodLabel} authenticated={Boolean(user)}
                hasChildren={events.hasChildren} incompleteChild={events.incompleteChild}
                incompleteChildren={events.incompleteChildren} />}
          </HomeEventsBoundary>}

        {sectionAvailability.classes ? (
          <CityHomeClassesSection
            cityName={getCityNominativeName(city.slug)}
            activities={classesMode === "local" ? localClasses : nearbyClasses}
            mode={classesMode}
          />
        ) : null}

        {sectionAvailability.birthday && birthdayOffers.length > 0 ? (
          <>
            <CityHomeBirthdayCta />
            <CityHomeBirthdayOffers offers={birthdayOffers} />
          </>
        ) : null}

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
