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

export default async function MinskCityHomePage() {
  const [city, user] = await Promise.all([
    prisma.city.findUnique({ where: { slug: "minsk" } }),
    getCurrentUser(),
  ]);

  const heroModel = await getHeroContext({
    citySlug: "minsk",
    cityName: "Минск",
    cityCenterLat: city?.centerLat ?? city?.lat ?? undefined,
    cityCenterLng: city?.centerLng ?? city?.lng ?? undefined,
    userName: user?.displayName?.trim() || user?.email?.split("@")[0] || null,
    personaMode: user ? "self" : "guest",
  });

  const kudaPreview = city
    ? await getKudaDiscoveryFeed(city.id, city.slug, user?.id ?? null, { take: 8 })
    : [];

  return (
    <div className="min-h-screen bg-white pb-20">
      <Container className="space-y-10 pt-10">
        <HeroGreetingShell initialModel={heroModel} />

        <div className="px-1">
          <ActivationBannerHost />
        </div>

        <StoriesSection />

        <CityHomeKudaSection activities={kudaPreview} />

        <CityHomeClassesSection />

        <CityHomeBirthdayCta />

        <CityHomeRoutesSection />

        <CityHomeJournalSection />
      </Container>
    </div>
  );
}
