"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  applyAlternative,
  buildDraftBody,
  canGoBack,
  emptyHistory,
  markExhausted,
  popDraft,
  pushDraft,
  removeItem,
  restartVariants,
  toDraft,
  MAX_TARGET_COUNT,
  type DraftHistory,
  type DraftItem,
  type DraftResponse,
  type ScenarioMode,
} from "../lib/dayScenarioUi/model";

export type DraftErrorKind = "rate_limited" | "unavailable" | "requires_auth" | "failed";

export type DateDraftState = {
  history: DraftHistory;
  loading: boolean;
  error: DraftErrorKind | null;
};

type Action =
  | { type: "reset"; dates: string[] }
  | { type: "loading"; date: string }
  | { type: "error"; date: string; error: DraftErrorKind }
  | { type: "history"; date: string; history: DraftHistory };

const fresh = (): DateDraftState => ({ history: emptyHistory(), loading: false, error: null });

function reducer(state: Record<string, DateDraftState>, action: Action): Record<string, DateDraftState> {
  switch (action.type) {
    case "reset":
      return Object.fromEntries(action.dates.map((date) => [date, fresh()]));
    case "loading":
      return { ...state, [action.date]: { ...(state[action.date] ?? fresh()), loading: true, error: null } };
    case "error":
      return { ...state, [action.date]: { ...(state[action.date] ?? fresh()), loading: false, error: action.error } };
    case "history":
      return { ...state, [action.date]: { history: action.history, loading: false, error: null } };
  }
}

class DraftApiError extends Error {
  constructor(readonly kind: DraftErrorKind) {
    super(kind);
  }
}

async function postDraft(body: unknown, signal: AbortSignal): Promise<DraftResponse> {
  const res = await fetch("/api/plan/day-scenario/draft", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 429) throw new DraftApiError("rate_limited");
  if (res.status === 404) throw new DraftApiError("unavailable");
  // A guest used up the allowance of built days: the way on is signing in.
  if (res.status === 403) throw new DraftApiError("requires_auth");
  if (!res.ok) throw new DraftApiError("failed");
  return (await res.json()) as DraftResponse;
}

export type DayScenarioDraftApi = {
  byDate: Record<string, DateDraftState>;
  /** "Другой вариант": a new variant that does not repeat a filler place already shown; may answer "exhausted". */
  another: (date: string) => void;
  /** "Показать заново" after "Мы показали всё, что подходит". */
  restart: (date: string) => void;
  /** "Вернуть прошлый": restore the previous draft, no request. */
  goBack: (date: string) => void;
  /** "Убрать": drop one point locally. */
  remove: (date: string, activityId: string) => void;
  /** "Добавить ещё": keep the points, ask for one more. */
  addMore: (date: string) => void;
  /** "Заменить": up to 3 whole-day variants, one request. Resolves to null on failure. */
  loadAlternatives: (date: string, activityId: string) => Promise<DraftItem[][] | null>;
  /** The chosen alternative replaces the draft. */
  chooseAlternative: (date: string, items: DraftItem[]) => void;
  retry: (date: string) => void;
  /** «Изменить день»: saved points the draft cannot show (no longer in the pool); a save keeps them as they are. */
  kept: { kind: "event" | "place"; activityId: string }[];
};

/**
 * Drafts for one or two days (the weekend). Everything that changes the audience, the mode or
 * the days starts every day over with a fresh build; the actions then work on one day.
 * Stale answers are dropped: only the newest request of a day may change its state.
 */
export function useDayScenarioDraft(input: {
  enabled: boolean;
  city: string;
  dates: string[];
  mode: ScenarioMode;
  ageRanges: string[];
  personaIds: string[];
  /** A guest's anonymous id: the server counts the first build of each date against the guest quota. Undefined for a member. */
  anonymousId?: string;
  /**
   * «Изменить день»: the saved points of the first day. The first draft of that day is a rebuild around them (all
   * pinned, as many points as were saved) instead of a fresh build, so the day opens as it is in the plan.
   */
  seed?: { kind: "event" | "place"; activityId: string; startsAt: string }[] | null;
}): DayScenarioDraftApi {
  const { enabled, city, dates, mode, ageRanges, personaIds, seed, anonymousId } = input;
  const [kept, setKept] = useState<{ kind: "event" | "place"; activityId: string }[]>([]);
  const seedRef = useRef(seed);
  seedRef.current = seed;
  const firstDateRef = useRef(dates[0]);
  firstDateRef.current = dates[0];
  const [byDate, dispatch] = useReducer(reducer, {} as Record<string, DateDraftState>);
  const stateRef = useRef(byDate);
  stateRef.current = byDate;
  const seq = useRef<Record<string, number>>({});
  const controllers = useRef<Record<string, AbortController>>({});

  const queryKey = JSON.stringify([enabled, city, dates, mode, ageRanges, personaIds]);
  const query = useMemo(
    () => (date: string) => ({ city, date, mode, ageRanges, personaIds, anonymousId, editScenario: Boolean(seedRef.current?.length) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey is the serialized identity of these inputs
    [queryKey],
  );
  const queryRef = useRef(query);
  queryRef.current = query;

  const request = useCallback(async (date: string, body: unknown): Promise<DraftResponse | null> => {
    controllers.current[date]?.abort();
    const controller = new AbortController();
    controllers.current[date] = controller;
    const mine = (seq.current[date] = (seq.current[date] ?? 0) + 1);
    dispatch({ type: "loading", date });
    try {
      const response = await postDraft(body, controller.signal);
      return seq.current[date] === mine ? response : null;
    } catch (error) {
      if (seq.current[date] === mine && !(error instanceof DOMException && error.name === "AbortError")) {
        dispatch({ type: "error", date, error: error instanceof DraftApiError ? error.kind : "failed" });
      }
      return null;
    }
  }, []);

  const build = useCallback(
    async (date: string) => {
      const saved = seedRef.current;
      const seeded = saved && saved.length > 0 && date === firstDateRef.current;
      const response = await request(
        date,
        seeded
          ? buildDraftBody(queryRef.current(date), "rebuild", { items: saved as unknown as DraftItem[], pinAll: true, targetCount: saved.length })
          : buildDraftBody(queryRef.current(date), "build"),
      );
      if (response) {
        dispatch({ type: "history", date, history: pushDraft(emptyHistory(), toDraft(response), 0) });
        // Saved points the pool no longer holds cannot be drawn, but they stay in the day: remembered for the save.
        if (seeded) {
          const missing = new Set(response.unpooledPinnedIds ?? []);
          setKept(saved.filter((point) => missing.has(point.activityId)).map((point) => ({ kind: point.kind, activityId: point.activityId })));
        }
      }
    },
    [request],
  );

  // A new audience / mode / day set: start every day over.
  useEffect(() => {
    if (!enabled || dates.length === 0) return;
    dispatch({ type: "reset", dates });
    for (const date of dates) void build(date);
    const running = controllers.current;
    return () => {
      for (const controller of Object.values(running)) controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey covers enabled/city/dates/mode/ages/personas
  }, [queryKey, build]);

  const another = useCallback(
    async (date: string) => {
      const history = stateRef.current[date]?.history;
      if (!history?.current) return;
      const variant = history.variant + 1;
      const response = await request(
        date,
        buildDraftBody(queryRef.current(date), "another", { variant, items: history.current.items, shown: history.shown }),
      );
      if (!response) return;
      const latest = stateRef.current[date]?.history ?? history;
      dispatch({ type: "history", date, history: response.exhausted ? markExhausted(latest) : pushDraft(latest, toDraft(response), response.variant) });
    },
    [request],
  );

  const restart = useCallback((date: string) => {
    const history = stateRef.current[date]?.history;
    if (history) dispatch({ type: "history", date, history: restartVariants(history) });
  }, []);

  const goBack = useCallback((date: string) => {
    const history = stateRef.current[date]?.history;
    if (history && canGoBack(history)) dispatch({ type: "history", date, history: popDraft(history) });
  }, []);

  const remove = useCallback((date: string, activityId: string) => {
    const history = stateRef.current[date]?.history;
    if (history) dispatch({ type: "history", date, history: removeItem(history, activityId) });
  }, []);

  const addMore = useCallback(
    async (date: string) => {
      const history = stateRef.current[date]?.history;
      if (!history?.current || history.current.items.length >= MAX_TARGET_COUNT) return;
      const items = history.current.items;
      const response = await request(
        date,
        buildDraftBody(queryRef.current(date), "rebuild", { variant: history.variant, items, pinAll: true, targetCount: items.length + 1 }),
      );
      if (response) dispatch({ type: "history", date, history: pushDraft(stateRef.current[date]?.history ?? history, toDraft(response), history.variant) });
    },
    [request],
  );

  const loadAlternatives = useCallback(async (date: string, activityId: string): Promise<DraftItem[][] | null> => {
    const history = stateRef.current[date]?.history;
    if (!history?.current) return null;
    try {
      // Not routed through `request`: opening the sheet must not blank the draft behind it.
      const controller = new AbortController();
      const response = await postDraft(
        buildDraftBody(queryRef.current(date), "alternatives", { items: history.current.items, replaceActivityId: activityId }),
        controller.signal,
      );
      return response.alternatives;
    } catch {
      return null;
    }
  }, []);

  const chooseAlternative = useCallback((date: string, items: DraftItem[]) => {
    const history = stateRef.current[date]?.history;
    if (history) dispatch({ type: "history", date, history: applyAlternative(history, items) });
  }, []);

  const retry = useCallback(
    (date: string) => {
      const history = stateRef.current[date]?.history;
      if (history?.current) void another(date);
      else void build(date);
    },
    [another, build],
  );

  return useMemo(
    () => ({
      byDate,
      another: (date: string) => void another(date),
      restart,
      goBack,
      remove,
      addMore: (date: string) => void addMore(date),
      loadAlternatives,
      chooseAlternative,
      retry,
      kept,
    }),
    [byDate, another, restart, goBack, remove, addMore, loadAlternatives, chooseAlternative, retry, kept],
  );
}
