import { Container } from "@/components/ui/Container";
import { H1 } from "@/components/ui/typography";
import { StoriesSection } from "@/features/stories/components/StoriesSection";
import { CityHomeBirthdayCta } from "@/features/city-home/components/CityHomeBirthdayCta";
import {
  CityHomeClassesSection,
  CityHomeJournalSection,
  CityHomeKudaSection,
  CityHomeRoutesSection,
} from "@/features/city-home/components/CityHomeContentRows";
import prisma from "@/lib/prisma";
import { getKudaDiscoveryFeed } from "@/server/discovery/kudaDiscoveryFeed";

export default async function MinskCityHomePage() {
  const city = await prisma.city.findUnique({ where: { slug: "minsk" } });
  const kudaPreview = city
    ? await getKudaDiscoveryFeed(city.id, city.slug, null, { take: 8 })
    : [];

  return (
    <div className="min-h-screen bg-white pb-20">
      <Container className="space-y-10 pt-10">
        <div className="space-y-1 px-1">
          <H1 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900">
            Фамилинг с mamaGo
          </H1>
          <p className="text-sm text-neutral-500 max-w-xl leading-relaxed pt-1">
            Персональный помощник в организации семейного отдыха и развития
          </p>
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
