"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  effectiveScenarioItems,
  isScenarioDraftDirty,
  restoreScenarioDraft,
  scenarioDraftReducer,
  scenarioDraftStorageKey,
  serializeScenarioDraft,
  suitableReplacementCandidates,
  unresolvedScenarioConflicts,
  type ScenarioClientItem,
  type ScenarioDraftState,
  type ScenarioReplacementCandidate,
} from "@/features/my-plan/lib/scenarioDraft";
import { conflictsForScenarioItems } from "@/features/my-plan/lib/scenarioDraft";

type CanonicalResponse = {
  items: ScenarioClientItem[];
  conflicts: ReturnType<typeof conflictsForScenarioItems>;
  acceptedConflictKeys: string[];
  fingerprint: string;
};

type Props = CanonicalResponse & { city: string; date: string };

const scenarioTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Minsk",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatScenarioTimeRange(item: Pick<ScenarioClientItem, "startsAt" | "endsAt">): string {
  if (!item.startsAt) return "Гибкое время";
  const start = scenarioTimeFormatter.format(new Date(item.startsAt));
  if (!item.endsAt) return start;
  return `${start}–${scenarioTimeFormatter.format(new Date(item.endsAt))}`;
}

type ConflictCardProps = {
  conflictKey: string;
  items: ScenarioClientItem[];
  onReplace: (planItemId: string) => void;
  onRemove: (planItemId: string) => void;
  onKeep: (conflictKey: string) => void;
};

export function ScenarioConflictCard({ conflictKey, items, onReplace, onRemove, onKeep }: ConflictCardProps) {
  const titles = items.map((item) => item.title).join(" и ");
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-label={`Пересечение: ${titles}`}>
      <h3 className="text-sm font-semibold text-amber-950">⚠ Время пересекается</h3>
      <p className="mt-1 text-xs text-amber-800">Выберите действие для каждого события или оставьте оба.</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.planItemId} className="rounded-xl bg-white/80 p-3">
            <p className="text-xs font-semibold tabular-nums text-amber-900">{formatScenarioTimeRange(item)}</p>
            <p className="mt-1 text-sm font-medium leading-snug text-neutral-900">{item.title}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="min-h-11 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium"
                aria-label={`Заменить: ${item.title}`}
                onClick={() => onReplace(item.planItemId)}
              >Заменить</button>
              <button
                className="min-h-11 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium"
                aria-label={`Удалить: ${item.title}`}
                onClick={() => onRemove(item.planItemId)}
              >Удалить</button>
            </div>
          </div>
        ))}
      </div>
      <button
        className="mt-3 min-h-11 rounded-full bg-white px-4 py-2 text-sm font-medium"
        aria-label={`Оставить оба: ${titles}`}
        onClick={() => onKeep(conflictKey)}
      >Оставить оба</button>
    </section>
  );
}

export function ScenarioUndoStatus({
  label,
  targetTitle,
  actionLabel = "Вернуть",
  onUndo,
}: {
  label: string;
  targetTitle: string;
  actionLabel?: "Вернуть" | "Отменить";
  onUndo: () => void;
}) {
  return (
    <p>
      {label} ·{" "}
      <button className="min-h-11 underline" aria-label={`${actionLabel}: ${targetTitle}`} onClick={onUndo}>
        {actionLabel}
      </button>
    </p>
  );
}

function initialState(items: ScenarioClientItem[], acceptedConflictKeys: string[]): ScenarioDraftState {
  return {
    original: items,
    originalAcceptedConflictKeys: [...acceptedConflictKeys].sort(),
    changes: {},
    acceptedConflictKeys: [...acceptedConflictKeys].sort(),
  };
}

export function ScenarioDraftEditor(props: Props) {
  const [state, dispatch] = useReducer(
    scenarioDraftReducer,
    initialState(props.items, props.acceptedConflictKeys),
  );
  const [baseFingerprint, setBaseFingerprint] = useState(props.fingerprint);
  const [restoreCandidate, setRestoreCandidate] = useState<ScenarioDraftState | null>(null);
  const [replacementFor, setReplacementFor] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ScenarioReplacementCandidate[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const requestedSuggestions = useRef(false);
  const saveKeyRef = useRef<{ signature: string; key: string } | null>(null);

  const items = useMemo(() => effectiveScenarioItems(state), [state]);
  const unresolved = useMemo(() => unresolvedScenarioConflicts(state), [state]);
  const dirty = isScenarioDraftDirty(state);
  const storageKey = scenarioDraftStorageKey(props.date, baseFingerprint);
  const titleById = new Map(items.map((item) => [item.planItemId, item.title]));

  useEffect(() => {
    const prefix = `scenarioDraft:${props.date}:`;
    let discardedStale = false;
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(prefix) && key !== storageKey) {
        sessionStorage.removeItem(key);
        discardedStale = true;
      }
    }
    if (discardedStale) setSaveError("План изменился, несохранённый вариант больше не актуален.");
    const raw = sessionStorage.getItem(storageKey);
    if (raw) setRestoreCandidate(restoreScenarioDraft(props.items, raw, props.acceptedConflictKeys));
  }, [props.acceptedConflictKeys, props.date, props.items, storageKey]);

  useEffect(() => {
    if (dirty) sessionStorage.setItem(storageKey, serializeScenarioDraft(state));
    else sessionStorage.removeItem(storageKey);
  }, [dirty, state, storageKey]);

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  useEffect(() => {
    const protectInternalNavigation = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (!window.confirm("Есть несохранённые изменения. Покинуть страницу?")) event.preventDefault();
    };
    document.addEventListener("click", protectInternalNavigation, true);
    return () => document.removeEventListener("click", protectInternalNavigation, true);
  }, [dirty]);

  async function openReplacements(planItemId: string) {
    setReplacementFor(planItemId);
    if (requestedSuggestions.current) return;
    requestedSuggestions.current = true;
    setLoadingCandidates(true);
    const exclude = items.map((item) => item.activityId).filter((id): id is string => id != null);
    try {
      const query = new URLSearchParams({ city: props.city, date: props.date, exclude: exclude.join(",") });
      const response = await fetch(`/api/plan/scenario/replacements?${query}`, { credentials: "include" });
      const data = (await response.json()) as { candidates?: ScenarioReplacementCandidate[] };
      setCandidates(response.ok && Array.isArray(data.candidates) ? data.candidates : []);
    } catch {
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  }

  const suitableCandidates = replacementFor && candidates
    ? suitableReplacementCandidates({ state, replacingPlanItemId: replacementFor, candidates })
    : [];

  async function save() {
    setSaving(true);
    setSaveError(null);
    const replacements = Object.entries(state.changes).flatMap(([planItemId, change]) =>
      change.state === "REPLACED"
        ? [{ planItemId, newActivityId: change.replacement.activityId!, activitySessionId: change.replacement.activitySessionId }]
        : [],
    );
    const removals = Object.entries(state.changes).flatMap(([planItemId, change]) =>
      change.state === "REMOVED" ? [planItemId] : [],
    );
    const signature = serializeScenarioDraft(state);
    if (saveKeyRef.current?.signature !== signature) {
      saveKeyRef.current = { signature, key: crypto.randomUUID() };
    }
    try {
      const response = await fetch("/api/plan/scenario", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": saveKeyRef.current.key },
        body: JSON.stringify({ date: props.date, baseFingerprint, replacements, removals, acceptedConflictKeys: state.acceptedConflictKeys }),
      });
      const data = (await response.json()) as CanonicalResponse & { code?: string };
      if (!response.ok) {
        setSaveError(data.code === "PLAN_CHANGED" ? "План изменился. Обновите его, чтобы продолжить." : "Не удалось сохранить план.");
        return;
      }
      sessionStorage.removeItem(storageKey);
      setBaseFingerprint(data.fingerprint);
      dispatch({ type: "resetCanonical", items: data.items, acceptedConflictKeys: data.acceptedConflictKeys });
      saveKeyRef.current = null;
    } catch {
      setSaveError("Не удалось сохранить план.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {restoreCandidate ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-sm font-medium text-sky-900">Есть несохранённые изменения</p>
          <div className="mt-3 flex gap-2">
            <button className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white" onClick={() => {
              dispatch({ type: "restoreDraft", draft: restoreCandidate });
              setRestoreCandidate(null);
            }}>Продолжить</button>
            <button className="rounded-full border px-4 py-2 text-sm" onClick={() => { sessionStorage.removeItem(storageKey); setRestoreCandidate(null); }}>Сбросить</button>
          </div>
        </div>
      ) : null}

      {unresolved.length > 0 ? (
        <h2 className="text-base font-semibold text-amber-800">
          ⚠ Нужно исправить {unresolved.length} {unresolved.length === 1 ? "конфликт" : unresolved.length >= 2 && unresolved.length <= 4 ? "конфликта" : "конфликтов"}
        </h2>
      ) : dirty ? <h2 className="text-base font-semibold text-emerald-700">Конфликты устранены · Изменения ещё не сохранены</h2> : null}

      {unresolved.map((conflict) => (
        <ScenarioConflictCard
          key={conflict.key}
          conflictKey={conflict.key}
          items={conflict.itemIds.flatMap((id) => {
            const item = items.find((candidate) => candidate.planItemId === id);
            return item ? [item] : [];
          })}
          onReplace={(planItemId) => void openReplacements(planItemId)}
          onRemove={(planItemId) => dispatch({ type: "remove", planItemId })}
          onKeep={(conflictKey) => dispatch({ type: "keep", conflictKey })}
        />
      ))}

      {state.acceptedConflictKeys.map((key) => (
        <div key={key} className="flex items-center gap-2 text-xs text-neutral-500">
          <ScenarioUndoStatus label="Оставлены оба" targetTitle="решение оставить оба события" actionLabel="Отменить" onUndo={() => dispatch({ type: "unkeep", conflictKey: key })} />
        </div>
      ))}

      {replacementFor ? (
        <div className="rounded-3xl border bg-white p-4 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="replacement-title">
          <div className="flex items-center justify-between gap-3"><h3 id="replacement-title" className="font-semibold">Чем заменить?</h3><button className="min-h-11 px-2" aria-label="Закрыть выбор замены" onClick={() => setReplacementFor(null)}>Закрыть</button></div>
          <p className="mt-1 text-sm text-neutral-600">{titleById.get(replacementFor) ?? "Событие"}</p>
          {loadingCandidates ? <p className="mt-4 text-sm text-neutral-500">Загрузка…</p> : suitableCandidates.length === 0 ? (
            <div className="mt-4"><p className="text-sm">Нет подходящих замен</p><button className="mt-3 rounded-full border px-3 py-2 text-sm" onClick={() => { dispatch({ type: "remove", planItemId: replacementFor }); setReplacementFor(null); }}>Удалить событие</button></div>
          ) : suitableCandidates.slice(0, 3).map((candidate) => (
            <div key={`${candidate.activityId}:${candidate.activitySessionId ?? "flex"}`} className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-2xl border p-3">
              {candidate.coverImageUrl ? <img src={candidate.coverImageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : null}
              <div className="min-w-0 flex-1"><Link href={candidate.href ?? "#"} className="font-medium break-words">{candidate.title}</Link><p className="text-xs text-neutral-500">{formatScenarioTimeRange(candidate)}</p></div>
              <button className="rounded-full bg-neutral-900 px-3 py-2 text-xs text-white" onClick={() => { dispatch({ type: "replace", planItemId: replacementFor, replacement: candidate }); setReplacementFor(null); }}>Выбрать</button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        {state.original.map((originalItem) => {
          const change = state.changes[originalItem.planItemId];
          if (change?.state === "REMOVED") return <div key={originalItem.planItemId} className="rounded-2xl border border-dashed p-4 text-sm text-neutral-500"><span className="font-medium text-neutral-700">{originalItem.title}</span><div className="mt-1"><ScenarioUndoStatus label="Удалено из черновика" targetTitle={originalItem.title} onUndo={() => dispatch({ type: "revert", planItemId: originalItem.planItemId })} /></div></div>;
          const current = items.find((item) => item.planItemId === originalItem.planItemId)!;
          return <div key={current.planItemId} className="rounded-2xl border bg-white p-4"><p className="font-semibold">{current.title}</p><p className="text-sm text-neutral-500">{formatScenarioTimeRange(current)}</p>{change?.state === "REPLACED" ? <div className="mt-2 text-xs text-emerald-700"><ScenarioUndoStatus label="Заменено" targetTitle={originalItem.title} onUndo={() => dispatch({ type: "revert", planItemId: current.planItemId })} /></div> : null}</div>;
        })}
      </div>

      {dirty ? <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl bg-neutral-900 p-4 text-white shadow-xl"><span className="text-sm">Есть несохранённые изменения</span><button disabled={saving} className="min-h-11 rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50" onClick={() => void save()}>{saving ? "Сохраняем…" : "Сохранить изменения"}</button></div> : null}
      {saveError ? <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{saveError}</div> : null}
    </div>
  );
}
