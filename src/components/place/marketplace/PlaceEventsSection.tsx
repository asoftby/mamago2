"use client";

import {
  EventCard,
  activityMockToEventCard,
  EVENT_CARD_SHELL,
} from "@/components/events";
import { HorizontalCardRow } from "@/features/city-home/components/HorizontalCardRow";
import type { ActivityMock } from "@/types/activity";

interface PlaceEventsSectionProps {
  activities: ActivityMock[];
  citySlug: string;
}

export function PlaceEventsSection({ activities, citySlug }: PlaceEventsSectionProps) {
  if (activities.length === 0) return null;

  return (
    <section
      style={{
        padding: "56px 0",
        borderTop: "1px solid rgba(20,18,16,.10)",
        background: "#ffffff",
      }}
    >
      <div
        style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}
        className="events-wrap"
        id="events"
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            marginBottom: 34,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="kicker-row" style={{ marginBottom: 14 }}>
              <span className="text-kicker">Афиша</span>
              <span className="kicker-line" style={{ width: 120 }} />
            </div>
            <h2
              style={{
                fontSize: 30,
                margin: 0,
                letterSpacing: "-.02em",
                color: "#141210",
                fontFamily: "var(--font-sans)",
                fontWeight: 400,
              }}
            >
              События в этом месте
            </h2>
          </div>
        </div>

        <HorizontalCardRow>
          {activities.slice(0, 4).map((activity) => (
            <div key={activity.id} className={EVENT_CARD_SHELL}>
              <EventCard {...activityMockToEventCard(activity, citySlug)} />
            </div>
          ))}
        </HorizontalCardRow>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .events-wrap { padding: 0 22px !important; }
        }
        @media (max-width: 520px) {
          .events-wrap { padding: 0 18px !important; }
        }
      `}</style>
    </section>
  );
}
