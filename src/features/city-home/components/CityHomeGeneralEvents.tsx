"use client";

import { useEffect, useState } from "react";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import Link from "next/link";
import { EventCard, activityMockToEventCard, EVENT_CARD_SHELL } from "@/components/events";
import { CityHomeSection } from "./CityHomeSection";
import { HorizontalCardRow } from "./HorizontalCardRow";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import type { ActivityMock } from "@/types/activity";

const CHILD_AGES = AGE_GROUPS.filter((g) => g.value !== "18+");
const MAX_PREVIEW_EVENTS = 10;

type AgeSelectionResult =
  | { state: "idle"; items: ActivityMock[] }
  | { state: "loading"; items: ActivityMock[] }
  | { state: "ready"; items: ActivityMock[] }
  | { state: "error"; items: ActivityMock[] };

type ListingPagePayload = {
  items?: Array<ActivityMock & { feedBucket?: "primary" | "secondary" }>;
};

/** Catalog membership is already determined by the shared public discovery pipeline. */
export function extractGuestAgeEvents(payload: ListingPagePayload, limit = MAX_PREVIEW_EVENTS): ActivityMock[] {
  if (!Array.isArray(payload.items)) return [];
  return payload.items.filter((item) => item.feedBucket === "primary").slice(0, limit);
}

/** Guest SEO SSR remains a public event carousel before any age is selected. */
export function CityHomeGeneralEvents({ activities, citySlug }: { activities: ActivityMock[]; citySlug: string }) {
  const [age, setAge] = useState<string | null>(null);
  const [results, setResults] = useState<AgeSelectionResult>({ state: "idle", items: activities });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!age) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) setResults({ state: "error", items: [] });
      controller.abort("timeout");
    }, 12_000);

    const loadAge = async () => {
      try {
        const params = new URLSearchParams({ listingCity: citySlug, age, page: "1" });
        const response = await fetch("/api/discovery/events/page?" + params, {
          cache: "no-store", credentials: "include", signal: controller.signal,
        });
        if (!response.ok) throw new Error("age_discovery_unavailable");
        const payload = (await response.json()) as ListingPagePayload;
        if (!controller.signal.aborted) setResults({ state: "ready", items: extractGuestAgeEvents(payload) });
      } catch {
        if (active) setResults({ state: "error", items: [] });
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void loadAge();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [age, citySlug, retryCount]);

  const select = (value: string) => {
    if (age === value) {
      setAge(null);
      setResults({ state: "idle", items: activities });
      return;
    }
    setAge(value);
    setResults({ state: "loading", items: [] });
  };

  const catalogHref = "/" + citySlug + "/events" + (age ? "?age=" + encodeURIComponent(age) : "");
  const activeAge = CHILD_AGES.find((group) => group.value === age);

  return <CityHomeSection title={"Куда пойти с ребёнком " + getCityLocativePhrase(citySlug)} reserveCarouselControls>
    <div className="mb-4 space-y-2">
      <p className="text-sm text-muted-foreground">Выберите возраст — покажем подходящие мероприятия без регистрации.</p>
      <div role="group" aria-label="Возраст ребёнка" className="flex gap-2 overflow-x-auto pb-1">
        {CHILD_AGES.map((group) => (
          <button key={group.value} type="button" aria-pressed={age === group.value} onClick={() => select(group.value)}
            className={"min-h-11 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors " +
              (age === group.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/50")}>
            {group.label}
          </button>
        ))}
      </div>
    </div>
    {age && results.state === "loading" ? (
      <p role="status" className="min-h-24 py-6 text-sm text-muted-foreground">Подбираем события по возрасту…</p>
    ) : age && results.state === "error" ? (
      <div role="alert" className="min-h-24 space-y-2 py-4">
        <p className="text-sm">Не удалось обновить подборку.</p>
        <button type="button" className="min-h-11 text-sm underline" onClick={() => {
          setResults({ state: "loading", items: [] });
          setRetryCount((count) => count + 1);
        }}>Повторить</button>
        <p><Link className="text-sm underline" href={catalogHref}>Открыть афишу по возрасту</Link></p>
      </div>
    ) : <>
      {results.items.length === 0 ? (
        <p role="status" className="py-6 text-sm text-muted-foreground">
          {activeAge ? "Пока нет мероприятий для возраста " + activeAge.label.toLowerCase() + "." : "Пока нет опубликованных событий. Загляните позже."}
        </p>
      ) : null}
      <HorizontalCardRow>
        {results.items.slice(0, MAX_PREVIEW_EVENTS).map((activity, index) => (
          <div key={activity.id} className={EVENT_CARD_SHELL}>
            <AnalyticsCardViewTracker entityType="EVENT" entityId={activity.id} vertical="CITY" citySlug={citySlug}
              threshold={0.5} dwellMs={1000} meta={{ section: "afisha", exposureId: activity.exposureId ?? null }}>
              <EventCard {...activityMockToEventCard(activity, citySlug)} framing="poster" imagePriority={index < 2} />
            </AnalyticsCardViewTracker>
          </div>
        ))}
        <div className={EVENT_CARD_SHELL}>
          <Link className="flex min-h-44 items-center justify-center rounded-2xl border border-dashed p-6 text-center"
            href={catalogHref}>{activeAge ? "Все события по возрасту" : "Все события"}</Link>
        </div>
      </HorizontalCardRow>
    </>}
  </CityHomeSection>;
}
