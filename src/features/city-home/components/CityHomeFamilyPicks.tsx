"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { EventCard, EVENT_CARD_SHELL } from "@/components/events";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { CityHomeSection } from "./CityHomeSection";
import { HorizontalCardRow } from "./HorizontalCardRow";
import { HomeMoreEventsCard } from "./HomeMoreEventsCard";
import { postAnalyticsEvent } from "@/lib/analytics/client";
import { formatPublicCardPrice } from "@/domain/pricing/publicCardPrice";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import { FAMILY_PERSONAS_CHANGED_EVENT } from "@/lib/family/familyPersonaEvents";
import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/client";
import { homeCatalogEvent, homeSelectionMode } from "../lib/homeInteractionTelemetry";
import { FamilyHomeCache, readHomeDismissals, HOME_DISMISS_TTL_MS } from "../lib/familyHomeCache";
import { homeAgeLabel, homePeriodLabel, minskPlanDate, type HomeFamilyContext } from "../lib/familyHome";
import { homeRecommendationLabel } from "../lib/homeRecommendationLabel";
import type { HomeFamilyDelivery } from "@/server/services/recommendations/familyPicks/delivery";

async function post(body: Record<string, unknown>, signal?: AbortSignal) {
  const timeout = new AbortController();
  const onAbort = () => timeout.abort();
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(onAbort, 15_000);
  try {
    const response = await fetch("/api/recommendations/family-picks", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: timeout.signal, keepalive: body.action === "dismiss",
    });
    if (!response.ok) throw new Error(`home_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/** One read-only family recommendation feed. Audience filtering belongs in the header/catalog. */
export function CityHomeFamilyPicks({ citySlug, initialContext }: { citySlug: string; initialContext: HomeFamilyContext }) {
  const router = useRouter();
  const auth = useAuthMe();
  const actor = initialContext.actorId!;
  const [data, setData] = useState<HomeFamilyDelivery | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [announcement, setAnnouncement] = useState("");
  const [impressed, setImpressed] = useState(new Set<string>());
  const cache = useRef(new FamilyHomeCache<HomeFamilyDelivery>(actor));
  const controller = useRef<AbortController | null>(null);

  const mounted = useRef(false);
  const initialSignatureRef = useRef(initialContext.signature);
  const allowedActor = useRef(false);

  const load = useCallback(async (options?: { keepCurrent?: boolean }) => {
    if (!mounted.current || !allowedActor.current) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const generation = cache.current.begin();
    if (!options?.keepCurrent) setState("loading");
    const valid = () => mounted.current && allowedActor.current && !abort.signal.aborted && cache.current.current(generation);
    const deadline = setTimeout(() => {
      if (valid()) {
        setState("error");
        setAnnouncement("Подбор не ответил вовремя. Повторите попытку.");
      }
      abort.abort();
    }, 15_000);
    try {
      const stored = readHomeDismissals(actor);

      // Signed context is refreshed before recommendation; child chips do not trigger
      // any additional queries, selection writes, or navigation on the home page.
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!valid()) return;
        const fresh = (await post({ action: "context", city: citySlug }, abort.signal)).context as HomeFamilyContext;
        if (!valid()) return;
        if (fresh.actorId !== actor || fresh.audience !== "personalized") {
          cache.current.cancel();
          setData(null);
          router.refresh();
          return;
        }
        const cached = cache.current.get(fresh, citySlug, null);
        if (cached) {
          setData(cached);
          setState("ready");
          return;
        }
        let result: HomeFamilyDelivery;
        try {
          result = await post({
            action: "recommend", city: citySlug, selectedChildId: null,
            signature: fresh.signature,
            dismissedIds: stored.map(entry => entry.id),
          }, abort.signal) as HomeFamilyDelivery;
        } catch (error) {
          if (valid() && attempt === 0 && error instanceof Error && error.message === "home_409") continue;
          throw error;
        }
        if (!valid()) return;
        if (result.context.actorId !== actor || result.context.signature !== fresh.signature) throw new Error("stale_context");
        cache.current.set(fresh, citySlug, null, result);
        setData(cache.current.filter(result, Date.now(), null));
        setState("ready");
        return;
      }
    } catch (error) {
      if (!valid()) return;
      if (error instanceof Error && /home_(401|403|404|409)/.test(error.message)) {
        cache.current.cancel();
        setData(null);
        router.refresh();
      }
      setState("error");
    } finally {
      clearTimeout(deadline);
    }
  }, [actor, citySlug, router]);

  useEffect(() => {
    mounted.current = true;
    allowedActor.current = !auth.isLoading && auth.user?.id === actor;
    for (const entry of readHomeDismissals(actor)) cache.current.dismiss(entry.id, entry.at + HOME_DISMISS_TTL_MS, entry.selectedChildId ?? null);
    void load();
    return () => { mounted.current = false; controller.current?.abort(); cache.current.cancel(); };
  }, [actor, load]);

  useEffect(() => {
    const refresh = () => { cache.current.clear(); void load({ keepCurrent: true }); };
    const logout = () => { allowedActor.current = false; controller.current?.abort(); cache.current.cancel(); setData(null); };
    window.addEventListener(FAMILY_PERSONAS_CHANGED_EVENT, refresh);
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, logout);
    return () => {
      window.removeEventListener(FAMILY_PERSONAS_CHANGED_EVENT, refresh);
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, logout);
    };
  }, [load]);

  useEffect(() => {
    const authorized = !auth.isLoading && auth.user?.id === actor;
    const wasAuthorized = allowedActor.current;
    allowedActor.current = authorized;
    if (!authorized) {
      controller.current?.abort();
      cache.current.cancel();
      setData(null);
    } else if (!wasAuthorized && mounted.current) {
      void load();
    }
  }, [actor, auth.isLoading, auth.user?.id, load]);

  useEffect(() => {
    // Don't invalidate the first mount; only react to a changed server identity snapshot.
    if (initialSignatureRef.current === initialContext.signature) return;
    initialSignatureRef.current = initialContext.signature;
    cache.current.cancel();
    setData(null);
    void load();
  }, [initialContext.signature, load]);

  const actorMatches = !auth.isLoading && auth.user?.id === actor;
  const catalogHref = `/${citySlug}/events`;
  return <CityHomeSection title="События, которые подходят вам"
    subtitle={data ? homePeriodLabel(data.window) : "На ближайшие 7 дней"} reserveCarouselControls>
    <div className="min-h-40" data-placement="HOME_FOR_FAMILY" aria-busy={state === "loading" && !data}>
      {!actorMatches || (state === "loading" && !data) ? (
        <div role="status"><span className="sr-only">Подбираем события…</span>
          <HorizontalCardRow>{[0, 1, 2, 3].map(id =>
            <div key={id} className={EVENT_CARD_SHELL}>
              <div className="aspect-[2/3] animate-pulse rounded-2xl bg-muted" />
              <div className="mt-3 h-16 rounded bg-muted/50" />
            </div>)}</HorizontalCardRow>
        </div>
      ) : state === "error" && !data ? (
        <div role="alert" className="py-8">
          <p>Не удалось загрузить события. Повторите попытку.</p>
          <button type="button" className="min-h-11 underline" onClick={() => void load()}>Повторить</button>
          <p><Link href={catalogHref} className="underline">Открыть каталог</Link></p>
        </div>
      ) : data ? (
        <FamilyHomeResults data={data} context={data.context} citySlug={citySlug} impressed={impressed}
          onImpression={identity => setImpressed(previous => new Set([...previous, identity]))} />
      ) : null}
      {state === "error" && data && <button type="button" className="mt-3 text-sm underline" onClick={() => void load({ keepCurrent: true })}>Не удалось обновить. Повторить</button>}
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    </div>
  </CityHomeSection>;
}

export function FamilyHomeResults({ data, context, citySlug, impressed, onImpression }: {
  data: HomeFamilyDelivery; context: HomeFamilyContext; citySlug: string;
  impressed: Set<string>; onImpression: (identity: string) => void;
}) {
  const items = data.items;
  const href = `/${citySlug}/events`;
  function meta(item: HomeFamilyDelivery["items"][number]) {
    return { source: item.exposureId ? "recommendation" as const : "listing" as const,
      section: "home" as const, placement: "HOME_FOR_FAMILY", recommendationSurface: "home" as const,
      policyVersion: data.policyVersion, selectionMode: homeSelectionMode(null), position: item.position,
      ...(data.runId ? { recommendationRunId: data.runId } : {}),
      ...(item.exposureId ? { recommendationExposureId: item.exposureId } : {}) };
  }
  return <HorizontalCardRow headerHasSubtitle>
    {items.slice(0, 10).map((item, index) => {
      const recommendation = homeRecommendationLabel(item, context);
      const identity = item.exposureId ?? `${context.signature}:all:${item.id}`;
      return <div key={identity} className={EVENT_CARD_SHELL + " flex flex-col"} data-recommendation-run={data.runId ?? undefined}>
        <AnalyticsCardViewTracker entityType="EVENT" entityId={item.id} vertical="CITY" citySlug={citySlug}
          threshold={0.5} dwellMs={1000} meta={meta(item)} wasImpressed={impressed.has(identity)}
          onImpression={() => onImpression(identity)}>
          <div className="flex h-full flex-col" onClickCapture={event => {
            if ((event.target as HTMLElement).closest("a")?.getAttribute("href") === item.href) {
              void postAnalyticsEvent({ eventType: "DETAIL_OPEN", entityType: "EVENT", entityId: item.id,
                vertical: "CITY", citySlug, meta: meta(item) });
            }
          }}>
            <EventCard id={item.id} title={item.title} href={item.href} imageUrl={item.imageUrl}
              imageWidth={item.imageWidth} imageHeight={item.imageHeight} framing="fixed" coverRatio="2/3"
              coverFit="cover" imagePriority={index < 2} saveMeta={{ dateISO: minskPlanDate(item.startsAt), source: "home-family-picks" }} categoryLabel={item.categoryName ?? undefined}
              metaLabel={`${homeAgeLabel(item)} · ${formatRuShortDayMonth(item.startsAt)}`}
              priceLabel={formatPublicCardPrice(item) ?? undefined} />
            {recommendation && <p className="pt-2 text-xs font-medium">{recommendation}</p>}
          </div>
        </AnalyticsCardViewTracker>
      </div>;
    })}
    <HomeMoreEventsCard href={href} hasEvents={data.hasCatalogEvents}
      onClick={() => void postAnalyticsEvent(homeCatalogEvent(null, citySlug))} />
  </HorizontalCardRow>;
}
