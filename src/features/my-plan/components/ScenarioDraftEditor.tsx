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
import type { ScenarioGap } from "@/features/my-plan/lib/scenarioTravel";
import { IcPlus } from "@/features/my-plan/components/scenarioIcons";
import {
  ScenarioCard,
  ScenarioConflictCluster,
  ScenarioGapRow,
  ScenarioUndoStatus,
  formatDurationLabel,
  formatScenarioTimeRange,
} from "@/features/my-plan/components/scenarioTimelineParts";
import styles from "./scenarioDay.module.css";

type CanonicalResponse = {
  items: ScenarioClientItem[];
  conflicts: ReturnType<typeof conflictsForScenarioItems>;
  acceptedConflictKeys: string[];
  fingerprint: string;
};

type Props = CanonicalResponse & {
  city: string;
  date: string;
  /** Estimated travel gap before each item, keyed by that item's
   * planItemId — precomputed server-side from the canonical (pre-edit)
   * order; hidden once that boundary is touched by an edit (see the
   * `gapUnedited` guard below), since it would otherwise go stale. */
  gaps: Record<string, ScenarioGap>;
  endOfDayLabel: string | null;
};

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
  const requestedFor = useRef<string | null>(null);
  const saveKeyRef = useRef<{ signature: string; key: string } | null>(null);

  const items = useMemo(() => effectiveScenarioItems(state), [state]);
  const unresolved = useMemo(() => unresolvedScenarioConflicts(state), [state]);
  const dirty = isScenarioDraftDirty(state);
  const storageKey = scenarioDraftStorageKey(props.date, baseFingerprint);

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
    setReplacementFor((current) => (current === planItemId ? null : planItemId));
    if (requestedFor.current === planItemId) return;
    requestedFor.current = planItemId;
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

  function candidatesFor(planItemId: string): ScenarioReplacementCandidate[] {
    if (replacementFor !== planItemId || !candidates) return [];
    return suitableReplacementCandidates({ state, replacingPlanItemId: planItemId, candidates });
  }

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

  // First (lowest-index) unresolved conflict each item participates in —
  // used to render exactly one inline cluster per conflict, at the position
  // of its earlier member, instead of showing conflicting items twice.
  const conflictByItemId = new Map<string, (typeof unresolved)[number]>();
  for (const conflict of unresolved) {
    for (const id of conflict.itemIds) {
      if (!conflictByItemId.has(id)) conflictByItemId.set(id, conflict);
    }
  }
  const renderedConflictKeys = new Set<string>();

  return (
    <>
      {restoreCandidate ? (
        <div className={styles.restoreBanner}>
          <p>Есть несохранённые изменения</p>
          <div className={styles.restoreActions}>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "restoreDraft", draft: restoreCandidate });
                setRestoreCandidate(null);
              }}
            >
              Продолжить
            </button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem(storageKey);
                setRestoreCandidate(null);
              }}
            >
              Сбросить
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.tl}>
        {state.original.map((originalItem, index) => {
          const change = state.changes[originalItem.planItemId];
          const previousOriginal = index > 0 ? state.original[index - 1] : null;
          const gap = props.gaps[originalItem.planItemId];
          const gapUnedited =
            gap != null && !change && (previousOriginal == null || !state.changes[previousOriginal.planItemId]);

          if (change?.state === "REMOVED") {
            return (
              <div key={originalItem.planItemId} className={styles.slot}>
                {gapUnedited ? <ScenarioGapRow gap={gap} styles={styles} /> : null}
                <ScenarioUndoStatus
                  label="Удалено из черновика"
                  targetTitle={originalItem.title}
                  styles={styles}
                  onUndo={() => dispatch({ type: "revert", planItemId: originalItem.planItemId })}
                />
              </div>
            );
          }

          const current = items.find((item) => item.planItemId === originalItem.planItemId)!;
          const conflict = conflictByItemId.get(originalItem.planItemId);

          if (conflict) {
            if (renderedConflictKeys.has(conflict.key)) return null;
            renderedConflictKeys.add(conflict.key);
            const clusterItems = conflict.itemIds
              .map((id) => items.find((item) => item.planItemId === id))
              .filter((item): item is ScenarioClientItem => item != null)
              // conflict.itemIds is ordered by id, not by time — sort
              // chronologically so the cluster's time label and card order
              // match what the user actually sees on the timeline.
              .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
            return (
              <div key={conflict.key} className={styles.slot}>
                {gapUnedited ? <ScenarioGapRow gap={gap} styles={styles} /> : null}
                <span className={styles.slotTime}>
                  {formatScenarioTimeRange(clusterItems[0]!)}
                  <i>пересечение</i>
                </span>
                <span className={`${styles.node} ${styles.nodeConflict}`} />
                <ScenarioConflictCluster
                  conflictKey={conflict.key}
                  items={clusterItems}
                  styles={styles}
                  onRemove={(planItemId) => dispatch({ type: "remove", planItemId })}
                  onKeepBoth={(conflictKey) => dispatch({ type: "keep", conflictKey })}
                  replacementFor={replacementFor}
                  loadingCandidates={loadingCandidates}
                  candidatesFor={candidatesFor}
                  onRequestReplacement={(planItemId) => void openReplacements(planItemId)}
                  onPickReplacement={(planItemId, replacement) => {
                    dispatch({ type: "replace", planItemId, replacement });
                    setReplacementFor(null);
                  }}
                />
              </div>
            );
          }

          const durationLabel = formatDurationLabel(current.durationMinutes);
          return (
            <div key={originalItem.planItemId} className={styles.slot}>
              {gapUnedited ? <ScenarioGapRow gap={gap} styles={styles} /> : null}
              <span className={styles.slotTime}>
                {formatScenarioTimeRange(current)}
                {durationLabel ? <i>{durationLabel}</i> : null}
              </span>
              <span className={styles.node} />
              <div className={styles.card}>
                <ScenarioCard item={current} styles={styles} onRemove={() => dispatch({ type: "remove", planItemId: originalItem.planItemId })} />
              </div>
              {change?.state === "REPLACED" ? (
                <ScenarioUndoStatus
                  label="Заменено"
                  targetTitle={originalItem.title}
                  styles={styles}
                  onUndo={() => dispatch({ type: "revert", planItemId: originalItem.planItemId })}
                />
              ) : null}
            </div>
          );
        })}

        {state.acceptedConflictKeys.map((key) => (
          <p key={key} className={styles.removedRow}>
            Оставлены оба ·{" "}
            <button type="button" className={styles.undo} aria-label="Отменить: конфликтная пара" onClick={() => dispatch({ type: "unkeep", conflictKey: key })}>
              Отменить
            </button>
          </p>
        ))}

        <Link href="/me/plan" className={styles.add}>
          <IcPlus /> Добавить событие в свободное окно
        </Link>
      </div>

      {props.endOfDayLabel ? <p className={styles.footNote}>День завершится около {props.endOfDayLabel}</p> : null}

      {dirty ? (
        <div className={styles.bar}>
          <div className={styles.barIn}>
            <span className={styles.barStatus}>Есть несохранённые изменения</span>
            <button type="button" disabled={saving} className={styles.barSave} onClick={() => void save()}>
              {saving ? "Сохраняем…" : "Сохранить изменения"}
            </button>
          </div>
        </div>
      ) : null}
      {saveError ? <div className={styles.saveError}>{saveError}</div> : null}
    </>
  );
}
