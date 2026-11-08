"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  applyAlternative,
  buildDraftBody,
  canGoBack,
  emptyHistory,
  popDraft,
  pushDraft,
  removeItem,
  toDraft,
  MAX_TARGET_COUNT,
  type DraftHistory,
  type DraftItem,
  type DraftResponse,
  type ScenarioMode,
} from "../lib/dayScenarioUi/model";

export type DraftErrorKind = "rate_limited" | "unavailable" | "failed";

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
  if (!res.ok) throw new DraftApiError("failed");
  return (await res.json()) as DraftResponse;
}

export type DayScenarioDraftApi = {
  byDate: Record<string, DateDraftState>;
  /** "Другой вариант": the next deterministic alternative of the whole day. */
  another: (date: string) => void;
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
};

/**
 * Drafts for one or two days (the weekend). Everything that changes the audience, the mode or
 * the days starts every day over with a fresh build; the actions then work on one day.
 * Stale answers are dropped: only the newest request of a day may change its state.
 */
export function useDayScenarioDraft(input: {
  enabled: boolean;
  dates: string[];
  mode: ScenarioMode;
  ageRanges: string[];
  personaIds: string[];
}): DayScenarioDraftApi {
  const { enabled, dates, mode, ageRanges, personaIds } = input;
  const [byDate, dispatch] = useReducer(reducer, {} as Record<string, DateDraftState>);
  const stateRef = useRef(byDate);
  stateRef.current = byDate;
  const seq = useRef<Record<string, number>>({});
  const controllers = useRef<Record<string, AbortController>>({});

  const queryKey = JSON.stringify([enabled, dates, mode, ageRanges, personaIds]);
  const query = useMemo(
    () => (date: string) => ({ date, mode, ageRanges, personaIds }),
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
      const response = await request(date, buildDraftBody(queryRef.current(date), "build"));
      if (response) dispatch({ type: "history", date, history: pushDraft(emptyHistory(), toDraft(response), 0) });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey covers enabled/dates/mode/ages/personas
  }, [queryKey, build]);

  const another = useCallback(
    async (date: string) => {
      const history = stateRef.current[date]?.history;
      if (!history?.current) return;
      const variant = history.variant + 1;
      const response = await request(date, buildDraftBody(queryRef.current(date), "rebuild", { variant, items: history.current.items }));
      if (response) dispatch({ type: "history", date, history: pushDraft(stateRef.current[date]?.history ?? history, toDraft(response), variant) });
    },
    [request],
  );

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
      goBack,
      remove,
      addMore: (date: string) => void addMore(date),
      loadAlternatives,
      chooseAlternative,
      retry,
    }),
    [byDate, another, goBack, remove, addMore, loadAlternatives, chooseAlternative, retry],
  );
}
