import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { StoriesSection } from "@/features/stories/components/StoriesSection";
import { CityHomeBirthdayCta } from "@/features/city-home/components/CityHomeBirthdayCta";
import { ActivationBannerHost } from "@/features/city-home/components/ActivationBannerHost";
import { getHeroContext } from "@/features/hero-weather/lib/get-hero-context";
import { HeroGreetingShell } from "@/features/hero-weather/ui/HeroGreetingShell";
import {
  CityHomeClassesSection,
  CityHomeJournalSection,
  CityHomeKudaSection,
  CityHomeRoutesSection,
} from "@/features/city-home/components/CityHomeContentRows";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getKudaDiscoveryFeed } from "@/server/discovery/kudaDiscoveryFeed";
import { listPublicRoutesByCity, listPublicRoutesByCityIds } from "@/server/services/route.service";
import { getCityNominativeName } from "@/lib/city/cityDisplayNames";
import { MOCK_ROUTES } from "@/mocks/routes.mock";
import { listCityHomeArticles } from "@/server/article/listCityHomeArticles";
import { listNearbyCities } from "@/server/city/listNearbyCities";
import { getClassesDiscoveryFeed } from "@/server/discovery/classesDiscoveryFeed";

interface CityHomePageProps {
  citySlug: string;
}

export default async function CityHomePage({ citySlug }: CityHomePageProps) {
  const [city, user] = await Promise.all([
    prisma.city.findUnique({ where: { slug: citySlug } }),
    getCurrentUser(),
  ]);

  if (!city) notFound();

  const heroModel = await getHeroContext({
    citySlug: city.slug,
    cityName: city.name,
    cityCenterLat: city.centerLat ?? city.lat ?? undefined,
    cityCenterLng: city.centerLng ?? city.lng ?? undefined,
    userName: user?.displayName?.trim() || user?.email?.split("@")[0] || null,
    personaMode: user ? "self" : "guest",
  });

  const nearbyCities = await listNearbyCities(city);
  const weatherRanking = {
    scenario: heroModel.weatherDayScenario,
    timeOfDay: heroModel.timeOfDay,
  };

  const [kudaPreview, localRoutes, journalArticles, localClasses, nearbyRoutes, nearbyClasses] = await Promise.all([
    getKudaDiscoveryFeed(city.id, city.slug, user?.id ?? null, {
      take: 8,
      weather: weatherRanking,
    }),
    listPublicRoutesByCity(city.id).catch(() => []),
    listCityHomeArticles(city),
    getClassesDiscoveryFeed([city.id], {
      take: 8,
      weather: weatherRanking,
    }).catch(() => []),
    listPublicRoutesByCityIds(nearbyCities.map((c) => c.id)).catch(() => []),
    getClassesDiscoveryFeed(nearbyCities.map((c) => c.id), {
      take: 8,
      weather: weatherRanking,
    }).catch(() => []),
  ]);

  const mapRoutePreview = (r: (typeof localRoutes)[number]) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    ageTags: r.ageTags,
    budgetLevel: r.budgetLevel,
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
  });

  const localRoutesPreview = localRoutes.map(mapRoutePreview);
  const nearbyRoutesPreviewDb = nearbyRoutes.map(mapRoutePreview);

  const mockForCity = MOCK_ROUTES.filter(
    (r) => r.cityName.toLowerCase() === city.name.toLowerCase(),
  );
  const localRouteItems = [
    ...localRoutesPreview,
    ...mockForCity.filter((m) => !localRoutesPreview.some((r) => r.slug === m.slug)),
  ].slice(0, 6);
  const nearbyCityNames = new Set(nearbyCities.map((c) => c.name.toLowerCase()));
  const nearbyMockRoutes = MOCK_ROUTES.filter((r) => nearbyCityNames.has(r.cityName.toLowerCase()));
  const nearbyRouteItems = [
    ...nearbyRoutesPreviewDb,
    ...nearbyMockRoutes.filter((m) => !nearbyRoutesPreviewDb.some((r) => r.slug === m.slug)),
  ].slice(0, 6);

  const classesMode = localClasses.length > 0 ? "local" : nearbyClasses.length > 0 ? "nearby" : "empty";
  const routesMode = localRouteItems.length > 0 ? "local" : nearbyRouteItems.length > 0 ? "nearby" : "empty";

  return (
    <div className="min-h-screen bg-white pb-20">
      <Container className="space-y-10 pt-10">
        <HeroGreetingShell initialModel={heroModel} />

        <div className="px-1">
          <ActivationBannerHost />
        </div>

        <StoriesSection />

        <CityHomeKudaSection activities={kudaPreview} />

        <CityHomeClassesSection
          cityName={getCityNominativeName(city.slug)}
          activities={classesMode === "local" ? localClasses : nearbyClasses}
          mode={classesMode}
        />

        <CityHomeBirthdayCta />

        <CityHomeRoutesSection
          routes={routesMode === "local" ? localRouteItems : nearbyRouteItems}
          mode={routesMode}
        />

        <CityHomeJournalSection articles={journalArticles} />
      </Container>
    </div>
  );
}
