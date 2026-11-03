import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import Link from "next/link";
import { EventCard, activityMockToEventCard, EVENT_CARD_SHELL } from "@/components/events";
import { CityHomeSection } from "./CityHomeSection";
import { HorizontalCardRow } from "./HorizontalCardRow";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import type { ActivityMock } from "@/types/activity";

/** Common SEO-readable SSR; never consumes header persona or discovery filter state. */
export function CityHomeGeneralEvents({ activities, citySlug }: { activities: ActivityMock[]; citySlug: string }) {
  return <CityHomeSection title={`Куда пойти с ребёнком ${getCityLocativePhrase(citySlug)}`} reserveCarouselControls>
    {!activities.length && <p role="status" className="py-6">Пока нет опубликованных событий. Загляните позже.</p>}
    <HorizontalCardRow>
      {activities.slice(0, 7).map((activity, index) => <div key={activity.id} className={EVENT_CARD_SHELL}><AnalyticsCardViewTracker entityType="EVENT" entityId={activity.id} vertical="CITY" citySlug={citySlug} threshold={0.5} dwellMs={1000} meta={{ section: "afisha", exposureId: activity.exposureId ?? null }}><EventCard {...activityMockToEventCard(activity, citySlug)} framing="poster" imagePriority={index < 2} /></AnalyticsCardViewTracker></div>)}
      <div className={EVENT_CARD_SHELL}><Link className="flex min-h-44 items-center justify-center rounded-2xl border border-dashed p-6 text-center" href={`/${citySlug}/events`}>Все события</Link></div>
    </HorizontalCardRow>
  </CityHomeSection>;
}
