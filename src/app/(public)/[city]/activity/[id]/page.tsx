import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { EventPageView } from "@/components/event-page";
import {
  attachSimilarEvents,
  buildEventPageData,
} from "@/lib/event/buildEventPageData";
import { MINSK_ACTIVITIES } from "@/mocks/activities.minsk";
import { loadPublicActivityForCityPage } from "@/lib/event/loadPublicActivityForCityPage";
import { buildEventPageDataFromPrismaActivity } from "@/lib/event/buildEventPageDataFromPrisma";

interface ActivityPageProps {
  params: Promise<{ city: string; id: string }>;
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { city, id } = await params;

  const fromDb = await loadPublicActivityForCityPage(city, id);
  if (fromDb) {
    const data = buildEventPageDataFromPrismaActivity(fromDb, { citySlug: city });
    return <EventPageView data={data} />;
  }

  const activity = MINSK_ACTIVITIES.find((a) => a.id === id);
  if (!activity) {
    return (
      <Container className="pt-20 text-center">
        <h1 className="text-2xl font-bold">Событие не найдено</h1>
        <Link
          href={`/${city}`}
          className="mt-4 block text-primary hover:underline"
        >
          На главную
        </Link>
      </Container>
    );
  }

  const data = attachSimilarEvents(
    buildEventPageData(activity, city),
    MINSK_ACTIVITIES,
    city,
    4,
  );

  return <EventPageView key={id} data={data} />;
}
