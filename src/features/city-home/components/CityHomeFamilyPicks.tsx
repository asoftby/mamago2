"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { EventCard, EVENT_CARD_SHELL } from "@/components/events";
import { AnalyticsCardViewTracker } from "@/components/analytics/AnalyticsCardViewTracker";
import { CityHomeSection } from "./CityHomeSection";
import { HorizontalCardRow } from "./HorizontalCardRow";
import { SaveHeart } from "@/features/save/SaveHeart";
import { postAnalyticsEvent } from "@/lib/analytics/client";
import { formatPublicCardPrice } from "@/domain/pricing/publicCardPrice";
import { formatRuShortDayMonth } from "@/lib/formatters/date";
import { FAMILY_PERSONAS_CHANGED_EVENT } from "@/lib/family/familyPersonaEvents";
import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/client";
import { HomeSelectionSync, persistHomeSelection } from "../lib/homeSelectionSync";
import { FamilyHomeCache, readHomeDismissals, writeHomeDismissals, HOME_DISMISS_TTL_MS, type HomeDismissal } from "../lib/familyHomeCache";
import { homeCatalogHref, homeSelection, homeSelectionLabel, homeAgeLabel, homePeriodLabel, minskPlanDate, type HomeFamilyContext } from "../lib/familyHome";
import type { HomeFamilyDelivery } from "@/server/services/recommendations/familyPicks/delivery";

async function post(body: Record<string, unknown>, signal?: AbortSignal) {
  const timeout = new AbortController();
  const onAbort = () => timeout.abort();
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(onAbort, 15_000);
  try {
    const response = await fetch("/api/recommendations/family-picks", { method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: timeout.signal });
    if (!response.ok) throw new Error(`home_${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }

}

export function CityHomeFamilyPicks({ citySlug, initialContext }: { citySlug: string; initialContext: HomeFamilyContext }) {
  const router = useRouter();
  const auth = useAuthMe();
  const actor = initialContext.actorId!;
  const [context, setContext] = useState(initialContext);
  const contextRef = useRef(initialContext);
  const [selected, setSelected] = useState<string | null>(initialContext.selectedChildId);
  const [data, setData] = useState<HomeFamilyDelivery | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [announcement, setAnnouncement] = useState("");
  const cache = useRef(new FamilyHomeCache<HomeFamilyDelivery>(actor));
  const controller = useRef<AbortController | null>(null);
  const dismissals = useRef<HomeDismissal[]>([]);
  const [impressed, setImpressed] = useState(new Set<string>());
  const selectionSync = useRef(new HomeSelectionSync(initialContext));
  const preferenceQueue = useRef(Promise.resolve());
  const mounted = useRef(false);
  const allowedActor = useRef(true);
  useEffect(() => { allowedActor.current = auth.user?.id === actor && !auth.isLoading; }, [actor, auth.user?.id, auth.isLoading]);

  const flushDismissals = useCallback(async () => {
    for (const entry of dismissals.current.filter(value => !value.saved)) {
      if (!allowedActor.current) return;
      try {
        await post({ action: "dismiss", city: entry.city, eventId: entry.id, exposureId: entry.exposureId, token: entry.token });
        entry.saved = true;
        writeHomeDismissals(actor, dismissals.current);
      } catch { if (allowedActor.current) setAnnouncement("Событие скрыто на этом устройстве. Повторим сохранение отказа."); }
    }
  }, [actor]);

  const load = useCallback(async () => {
    if (!mounted.current || !allowedActor.current) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const generation = cache.current.begin();
    setState("loading");
    const valid = () => mounted.current && !abort.signal.aborted && allowedActor.current && cache.current.current(generation);
    try {
      const stored = readHomeDismissals(actor);
      const merged = new Map(dismissals.current.filter(entry => Date.now() - entry.at < HOME_DISMISS_TTL_MS).map(entry => [entry.id, entry]));
      for (const entry of stored) {
        if (!merged.has(entry.id)) cache.current.dismiss(entry.id, entry.at + HOME_DISMISS_TTL_MS);
        const previous = merged.get(entry.id);
        if (!previous || entry.at > previous.at || (entry.token === previous.token && entry.saved)) merged.set(entry.id, entry);
      }
      dismissals.current = [...merged.values()].slice(-200);
      await flushDismissals();
      if (!valid()) return;
      const fresh = (await post({ action: "context", city: citySlug }, abort.signal)).context as HomeFamilyContext;
      if (!valid()) return;
      if (fresh.actorId !== actor || fresh.audience !== "personalized") { cache.current.cancel(); router.refresh(); return; }
      const choice = selectionSync.current.reconcile(fresh);
      setSelected(choice);
      if (contextRef.current.signature !== fresh.signature) cache.current.clear();
      contextRef.current = fresh;
      setContext(fresh);
      const cached = cache.current.get(fresh, citySlug, choice);
      if (cached) { setData(cached); setState("ready"); return; }
      const result = await post({ action: "recommend", city: citySlug, selectedChildId: choice, signature: fresh.signature,
        dismissedIds: dismissals.current.map(entry => entry.id) }, abort.signal) as HomeFamilyDelivery;
      if (!valid()) return;
      if (result.context.actorId !== actor || result.context.signature !== fresh.signature) throw new Error("stale_context");
      cache.current.set(fresh, citySlug, choice, result);
      setData(cache.current.filter(result));
      setState("ready");
    } catch (error) {
      if (!valid()) return;
      if (error instanceof Error && /home_(401|403|404|409)/.test(error.message)) { cache.current.cancel(); router.refresh(); }
      setState("error");
    }
  }, [actor, citySlug, flushDismissals, router]);

  useEffect(() => {
    mounted.current = true;
    dismissals.current = readHomeDismissals(actor);
    for (const entry of dismissals.current) cache.current.dismiss(entry.id, entry.at + HOME_DISMISS_TTL_MS);
    void load();
    const memory = cache.current;
    const choices = selectionSync.current;
    return () => { mounted.current = false; choices.cancel(); controller.current?.abort(); memory.cancel(); };
  }, [actor, load]);

  useEffect(() => {
    const refresh = () => { cache.current.clear(); void load(); };
    const logout = () => { selectionSync.current.cancel(); allowedActor.current = false; controller.current?.abort(); cache.current.cancel(); setData(null); setState("loading"); };
    const focus = () => { void load(); };
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener(FAMILY_PERSONAS_CHANGED_EVENT, refresh);
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, logout);
    const storage = (event: StorageEvent) => { if (event.key === `mg_family_home_dismissed:${actor}`) void load(); };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener(FAMILY_PERSONAS_CHANGED_EVENT, refresh); window.removeEventListener(AUTH_STATE_CHANGED_EVENT, logout); window.removeEventListener("focus", focus); window.removeEventListener("storage", storage); document.removeEventListener("visibilitychange", visible); };
  }, [load, actor]);

  useEffect(() => {
    if (initialContext.signature !== contextRef.current.signature
      || initialContext.preferenceVersion !== contextRef.current.preferenceVersion
      || initialContext.selectedChildId !== contextRef.current.selectedChildId) void load();
  }, [initialContext.signature, initialContext.preferenceVersion, initialContext.selectedChildId, load]);

  function select(id: string | null) {
    const choice = homeSelection(context, id);
    const token = selectionSync.current.begin(choice);
    setSelected(choice);
    setAnnouncement("Сохраняем выбор на аккаунте…");
    preferenceQueue.current = preferenceQueue.current.catch(() => {}).then(async () => {
      if (!mounted.current || !allowedActor.current || !selectionSync.current.isPending(token)) return;
      const result = await persistHomeSelection(selectionSync.current, token, {
        context: async () => {
          if (!mounted.current || !allowedActor.current) throw new Error("selection_actor_changed");
          const fresh = (await post({ action: "context", city: citySlug })).context as HomeFamilyContext;
          if (!mounted.current || !allowedActor.current || fresh.actorId !== actor) throw new Error("selection_actor_changed");
          return fresh;
        },
        save: async (selectedChildId, version) => {
          if (!mounted.current || !allowedActor.current) throw new Error("selection_actor_changed");
          await post({ action: "selection", city: citySlug, selectedChildId, version });
        },
      });
      if (!mounted.current || !allowedActor.current || result === "obsolete") return;
      setAnnouncement(result === "saved" ? "Выбор обновлён на аккаунте." : result === "conflict"
        ? "Выбор изменён на другом устройстве. Показываем актуальный выбор аккаунта."
        : "Не удалось подтвердить сохранение. Обновляем выбор из аккаунта.");
      void load();
    });
    void load();
  }

  function dismiss(item: HomeFamilyDelivery["items"][number]) {
    cache.current.dismiss(item.id);
    dismissals.current = [...dismissals.current.filter(entry => entry.id !== item.id), { id: item.id, token: crypto.randomUUID(), at: Date.now(), exposureId: item.exposureId, city: citySlug, saved: false }].slice(-200);
    writeHomeDismissals(actor, dismissals.current);
    setData(value => value ? cache.current.filter(value) : value);
    setAnnouncement(`«${item.title}» скрыто из всех подборок`);
    void load();
  }
  const choiceChild = context.children.find(child => child.id === selected);
  const href = homeCatalogHref(citySlug, context, selected);
  const actorMatches = auth.user?.id === actor && !auth.isLoading;
  return <CityHomeSection title="Для вашей семьи" subtitle={data ? homePeriodLabel(data.window) : "Подбираем события для вашей семьи"} reserveCarouselControls>
    <div className="min-h-[500px]" data-placement="HOME_FOR_FAMILY" aria-busy={state === "loading"}>
      {context.children.length > 1 && <div role="group" aria-label="Для кого подобрать события" className="mb-4 flex gap-2 overflow-x-auto py-1"
        onKeyDown={event => {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === "ArrowRight" ? (index + 1) % buttons.length : event.key === "ArrowLeft" ? (index + buttons.length - 1) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); buttons[next]?.click(); }
        }}>
        {[{ id: null, label: "Вся семья" }, ...context.children.map(child => ({ id: child.id, label: child.name?.trim() || "Ребёнок" }))].map(chip => <button key={chip.id ?? "all"} type="button"
          aria-pressed={selected === chip.id} tabIndex={selected === chip.id ? 0 : -1} onClick={() => select(chip.id)}
          className={`min-h-11 shrink-0 rounded-full border px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === chip.id ? "bg-primary text-primary-foreground" : "bg-background"}`}>{chip.label}</button>)}
      </div>}
      {context.selectionPersistence === "device" && <p className="mb-3 text-xs text-muted-foreground">Выбор запоминается на этом устройстве.</p>}
      {choiceChild && !choiceChild.hasBirthDate && <p className="mb-4 text-sm">Укажите дату рождения ребёнка — тогда мы сможем подобрать события по возрасту. <Link href="/me/profile" className="underline">Заполнить профиль</Link></p>}
      {(!actorMatches || state === "loading") ? <div role="status"><span className="sr-only">Подбираем события…</span><HorizontalCardRow>{[0, 1, 2, 3].map(id => <div key={id} className={EVENT_CARD_SHELL}><div className="aspect-[2/3] animate-pulse rounded-2xl bg-muted" /><div className="mt-3 h-16 rounded bg-muted/50" /></div>)}</HorizontalCardRow></div> :
        state === "error" ? <div role="alert" className="py-8"><p>Не удалось загрузить события. Повторите попытку.</p><button type="button" className="min-h-11 underline" onClick={() => void load()}>Повторить</button><p><Link href={href} className="underline">Открыть каталог</Link></p></div> : <FamilyHomeResults data={data!} context={context} citySlug={citySlug} selected={selected} impressed={impressed}
          onImpression={identity => setImpressed(previous => new Set([...previous, identity]))}
          onDismiss={dismiss} onSave={() => { cache.current.clear(); void load(); }} />}
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    </div>
  </CityHomeSection>;
}

/** Shared real ready/empty rendering, also exercised by SSR contract tests. */
export function FamilyHomeResults({ data, context, citySlug, selected, impressed, onImpression, onDismiss, onSave }: {
  data: HomeFamilyDelivery; context: HomeFamilyContext; citySlug: string; selected: string | null;
  impressed: Set<string>; onImpression: (identity: string) => void;
  onDismiss: (item: HomeFamilyDelivery["items"][number]) => void; onSave: () => void;
}) {
  const items = data.items;
  const href = homeCatalogHref(citySlug, context, selected);
  function meta(item: HomeFamilyDelivery["items"][number]) {
    return { source: item.exposureId ? "recommendation" as const : "listing" as const, section: "home" as const, placement: "HOME_FOR_FAMILY", recommendationSurface: "home" as const,
      policyVersion: data?.policyVersion, selection: selected ?? "ALL_FAMILY", position: item.position,
      ...(data?.runId ? { recommendationRunId: data.runId } : {}), ...(item.exposureId ? { recommendationExposureId: item.exposureId } : {}) };
  }
  return <>
          {!items.length && <p role="status" className="mb-5 py-6">{data?.window.horizonDays === 30 ? "На ближайшие 30 дней нет подтверждённых событий по возрасту." : "В выбранном периоде пока нет подходящих событий."}</p>}
          <HorizontalCardRow headerHasSubtitle>
            {items.slice(0, 7).map((item, index) => {
              const badge = item.allChildrenMatch ? "Подходит всем" : `Подходит: ${context.children.filter(child => item.matchedChildIds.includes(child.id)).map(child => child.name?.trim() || "ребёнок").join(", ")}`;
              const identity = item.exposureId ?? `${context.signature}:${selected}:${item.id}`;
              return <div key={identity} className={EVENT_CARD_SHELL} data-recommendation-run={data?.runId ?? undefined}>
                <AnalyticsCardViewTracker key={identity} entityType="EVENT" entityId={item.id} vertical="CITY" citySlug={citySlug} threshold={0.5} dwellMs={1000}
                  meta={meta(item)} wasImpressed={impressed.has(identity)} onImpression={() => onImpression(identity)}>
                  <div onClickCapture={event => { if ((event.target as HTMLElement).closest("a")?.getAttribute("href") === item.href) void postAnalyticsEvent({ eventType: "DETAIL_OPEN", entityType: "EVENT", entityId: item.id, vertical: "CITY", citySlug, meta: meta(item) }); }}>
                    <EventCard id={item.id} title={item.title} href={item.href} imageUrl={item.imageUrl} imageWidth={item.imageWidth} imageHeight={item.imageHeight} framing="poster" imagePriority={index < 2}
                      categoryLabel={item.categoryName ?? undefined} metaLabel={`${homeAgeLabel(item)} · ${formatRuShortDayMonth(item.startsAt)}`} priceLabel={formatPublicCardPrice(item) ?? undefined} />
                    <p className="mt-2 text-xs font-medium">{badge}</p>
                    <div className="mt-3 flex flex-wrap gap-2"><SaveHeart activityId={item.id} activityTitle={item.title} coverImageUrl={item.imageUrl} eventPlanDateISO={minskPlanDate(item.startsAt)} source="home-family-picks" triggerLabel="В мой план" onSaveChange={onSave} />
                      <button type="button" onClick={() => onDismiss(item)} className="min-h-11 px-2 text-sm underline">Не подходит</button></div>
                  </div>
                </AnalyticsCardViewTracker>
              </div>;
            })}
            <div className={EVENT_CARD_SHELL}><Link href={href} className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed p-6 text-center">Все события для {homeSelectionLabel(context, selected)}</Link></div>
          </HorizontalCardRow>
        </>;
}
