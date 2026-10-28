"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EventCard, EVENT_CARD_SHELL } from "@/components/events";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { CityHomeSection } from "@/features/city-home/components/CityHomeSection";
import { HorizontalCardRow } from "@/features/city-home/components/HorizontalCardRow";
import { SaveHeart } from "@/features/save/SaveHeart";
import {
  FAMILY_PICKS_PLACEMENT,
  familyPickAnalyticsMeta,
  familyPicksSubtitle,
  familyPicksTitle,
  otherIdeasHref,
  readDismissedIds,
  rememberDismissedId,
  shouldInviteToProfile,
} from "@/features/city-home/lib/familyPicksView";
import { postAnalyticsEvent } from "@/lib/analytics/client";
import { IMPRESSION_DWELL_MS, IMPRESSION_VISIBLE_RATIO } from "@/lib/analytics/impressionGate";
import { getOrCreateAnonymousId } from "@/lib/anonymous/clientAnonymousId";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import type { FamilyPickCard, FamilyPicksResponse } from "@/server/services/recommendations/familyPicks/load";

function useFamilyPicks(citySlug: string) {
  const [data, setData] = useState<FamilyPicksResponse | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const anonymousId = getOrCreateAnonymousId();
    const qs = new URLSearchParams({ city: citySlug });
    if (anonymousId) qs.set("anonymousId", anonymousId);
    fetch(`/api/recommendations/family-picks?${qs.toString()}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<FamilyPicksResponse>) : null))
      .then((json) => setData(json))
      .catch(() => setData(null));
    return () => controller.abort();
  }, [citySlug]);
  return data;
}

function ReasonChips({ chips }: { chips: string[] }) {
  if (chips.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5 px-0.5" aria-label="Почему рекомендуем">
      {chips.map((chip) => (
        <li
          key={chip}
          className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium leading-none text-foreground/80"
        >
          {chip}
        </li>
      ))}
    </ul>
  );
}

function PickCard({
  pick,
  citySlug,
  response,
  index,
  onDismiss,
}: {
  pick: FamilyPickCard;
  citySlug: string;
  response: FamilyPicksResponse;
  index: number;
  onDismiss: (pick: FamilyPickCard) => void;
}) {
  const meta = familyPickAnalyticsMeta({ level: response.level, runId: response.runId, item: pick });
  const dateISO = pick.startsAt ? pick.startsAt.slice(0, 10) : null;
  const metaLabel = [pick.ageLabel, pick.startsAt ? formatRuShortDayMonth(pick.startsAt) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <AnalyticsCardViewTracker
      entityType="EVENT"
      entityId={pick.id}
      vertical="CITY"
      citySlug={citySlug}
      threshold={IMPRESSION_VISIBLE_RATIO}
      dwellMs={IMPRESSION_DWELL_MS}
      meta={meta}
    >
      <div
        onClickCapture={(e) => {
          // Переход по карточке — действие, привязанное к экспозиции.
          if ((e.target as HTMLElement).closest("a")) {
            void postAnalyticsEvent({
              eventType: "DETAIL_OPEN",
              entityType: "EVENT",
              entityId: pick.id,
              vertical: "CITY",
              citySlug,
              meta,
            });
          }
        }}
      >
        <EventCard
          id={pick.id}
          title={pick.title}
          href={pick.href}
          imageUrl={pick.imageUrl}
          categoryLabel={pick.categoryName?.toUpperCase()}
          metaLabel={metaLabel || undefined}
          priceLabel={pick.isFree ? "бесплатно" : pick.priceText ?? undefined}
          imagePriority={index < 2}
          saveMeta={{ dateISO, source: "home-family-picks" }}
        />
        <ReasonChips chips={pick.reasonChips} />
        <div className="mt-3 flex flex-wrap gap-2">
          <SaveHeart
            activityId={pick.id}
            activityTitle={pick.title}
            coverImageUrl={pick.imageUrl}
            eventPlanDateISO={dateISO}
            source="home-family-picks"
            triggerLabel="В мой план"
          />
          <button
            type="button"
            onClick={() => onDismiss(pick)}
            className="inline-flex min-h-11 items-center justify-center rounded-full px-3 text-[13px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Не подходит
          </button>
        </div>
      </div>
    </AnalyticsCardViewTracker>
  );
}

/**
 * Блок «Для вашей семьи» на главной города. Данные — серверная выдача
 * `/api/recommendations/family-picks`; пока нет данных или выдача пуста — блок не рендерится.
 */
export function CityHomeFamilyPicks({ citySlug }: { citySlug: string }) {
  const response = useFamilyPicks(citySlug);
  // Блок рендерится только после клиентского fetch, поэтому чтение localStorage в инициализаторе безопасно.
  const [dismissed, setDismissed] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readDismissedIds(),
  );
  const [announcement, setAnnouncement] = useState("");

  const handleDismiss = useCallback(
    (pick: FamilyPickCard) => {
      if (!response) return;
      rememberDismissedId(pick.id);
      setDismissed((prev) => [...prev, pick.id]);
      setAnnouncement(`«${pick.title}» скрыто из подборки`);
      void postAnalyticsEvent({
        eventType: "DISMISS",
        entityType: "EVENT",
        entityId: pick.id,
        vertical: "CITY",
        citySlug,
        meta: familyPickAnalyticsMeta({ level: response.level, runId: response.runId, item: pick }),
      });
    },
    [response, citySlug],
  );

  if (!response || response.level === "NONE") return null;
  const picks = response.items.filter((item) => !dismissed.includes(item.id));
  // Пустой блок не показываем: после «Не подходит» ниже минимума он исчезает целиком.
  if (picks.length === 0) return null;

  const title = familyPicksTitle({
    audience: response.audience,
    level: response.level,
    serverTitle: response.title,
    cityLocative: getCityLocativePhrase(citySlug),
  });
  if (!title) return null;
  const ideasHref = otherIdeasHref({ citySlug, ageFilter: response.ageFilter, mode: response.window.mode });

  return (
    <CityHomeSection
      className="pt-[5px]"
      title={title}
      subtitle={familyPicksSubtitle(response.window.mode)}
      reserveCarouselControls
    >
      <div data-placement={FAMILY_PICKS_PLACEMENT}>
        {shouldInviteToProfile(response.level) ? (
          <p className="mb-3 px-1 text-sm leading-relaxed text-muted-foreground">
            Добавьте детей в профиль — подберём точнее.{" "}
            <Link
              href="/me/profile"
              className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Заполнить профиль
            </Link>
          </p>
        ) : null}
        <HorizontalCardRow headerHasSubtitle>
          {picks.map((pick, index) => (
            <div key={pick.id} className={EVENT_CARD_SHELL}>
              <PickCard
                pick={pick}
                citySlug={citySlug}
                response={response}
                index={index}
                onDismiss={handleDismiss}
              />
            </div>
          ))}
          <div className={EVENT_CARD_SHELL}>
            <Link
              href={ideasHref}
              className="flex aspect-[4/5] min-h-11 w-full flex-col items-center justify-center rounded-[18px] border border-dashed border-border bg-muted/40 p-4 text-center text-[15px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Другие идеи
              <span className="mt-1 text-[12px] font-normal text-muted-foreground">Куда пойти →</span>
            </Link>
          </div>
        </HorizontalCardRow>
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </CityHomeSection>
  );
}
