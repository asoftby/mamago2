import { Container } from "@/components/ui/Container";
import { H1 } from "@/components/ui/typography";
import { CityHomeBreakingNews } from "@/features/city-home/components/CityHomeBreakingNews";
import { CityHomeBirthdayCta } from "@/features/city-home/components/CityHomeBirthdayCta";
import {
  CityHomeClassesSection,
  CityHomeJournalSection,
  CityHomeKudaSection,
  CityHomeRoutesSection,
} from "@/features/city-home/components/CityHomeContentRows";
import { MINSK_BREAKING_NEWS } from "@/features/city-home/data/minskCityHome";

export function MinskCityHomePage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* pt-10 = тот же шаг, что space-y-10 (2.5rem). В layout уже есть <main> — здесь только div. */}
      <Container className="space-y-10 pt-10">
        <div className="space-y-1 px-1">
          <H1 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900">
            Фамилинг с mamaGo
          </H1>
          <p className="text-sm text-neutral-500 max-w-xl leading-relaxed pt-1">
            Персональный помощник в организации семейного отдыха и развития
          </p>
        </div>

        <CityHomeBreakingNews items={MINSK_BREAKING_NEWS} />

        <CityHomeKudaSection />

        <CityHomeClassesSection />

        <CityHomeBirthdayCta />

        <CityHomeRoutesSection />

        <CityHomeJournalSection />
      </Container>
    </div>
  );
}
