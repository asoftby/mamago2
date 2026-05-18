"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Activity } from "@prisma/client";
import { getDefaultFormData } from "./defaults";
import { mapEventToFormData, type ActivityWithRelations } from "./mappers";
import type { EventFormData, EventWizardMode } from "./types";

const DEBUG_EDITOR = process.env.NODE_ENV !== "production";
const EVENT_EDITOR_DRAFT_KEY_PREFIX = "mg.eventEditor.draft";

function debugDraftLog(message: string, payload?: Record<string, unknown>) {
  if (!DEBUG_EDITOR) return;
  if (payload) {
    console.debug(`[EventEditorDraft] ${message}`, payload);
    return;
  }
  console.debug(`[EventEditorDraft] ${message}`);
}

function buildInitialDraft(mode: EventWizardMode, event?: Activity): EventFormData {
  if (mode === "edit" && event) {
    return mapEventToFormData(event as unknown as ActivityWithRelations);
  }
  return getDefaultFormData();
}

function readPersistedDraft(storageKey: string): EventFormData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as EventFormData;
  } catch (error) {
    debugDraftLog("failed to read persisted draft", {
      storageKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function useEventEditorDraft(params: {
  mode: EventWizardMode;
  event?: Activity;
  persistenceKey?: string | null;
}) {
  const initialDraft = useMemo(
    () => buildInitialDraft(params.mode, params.event),
    [params.mode, params.event],
  );
  const [draft, setDraft] = useState<EventFormData>(() =>
    buildInitialDraft(params.mode, params.event),
  );
  const storageKey = useMemo(() => {
    const suffix = params.persistenceKey ?? params.event?.id ?? params.mode;
    return `${EVENT_EDITOR_DRAFT_KEY_PREFIX}:${params.mode}:${suffix}`;
  }, [params.event?.id, params.mode, params.persistenceKey]);
  const hydratedKeyRef = useRef<string | null>(null);

  const patchDraft = useCallback(
    (
      updates:
        | Partial<EventFormData>
        | ((prev: EventFormData) => Partial<EventFormData>),
    ) => {
      setDraft((prev) => {
        const patch = typeof updates === "function" ? updates(prev) : updates;
        return { ...prev, ...patch };
      });
    },
    [],
  );

  const hydrateFromServer = useCallback((event?: Activity) => {
    setDraft(buildInitialDraft("edit", event));
  }, []);

  const clearPersistedDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(storageKey);
      debugDraftLog("cleared persisted draft", { storageKey });
    } catch (error) {
      debugDraftLog("failed to clear persisted draft", {
        storageKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [storageKey]);

  /* eslint-disable react-hooks/set-state-in-effect -- one-shot sessionStorage vs server draft hydration; ref gate pairs with persist effect */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hydratedKeyRef.current === storageKey) return;

    const persistedDraft = readPersistedDraft(storageKey);
    if (persistedDraft) {
      debugDraftLog("hydrated from sessionStorage", {
        storageKey,
        mode: params.mode,
        eventId: params.event?.id ?? null,
      });
      setDraft(persistedDraft);
    } else {
      debugDraftLog("hydrated from server payload", {
        storageKey,
        mode: params.mode,
        eventId: params.event?.id ?? null,
      });
      setDraft(initialDraft);
    }

    hydratedKeyRef.current = storageKey;
  }, [initialDraft, params.event?.id, params.mode, storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hydratedKeyRef.current !== storageKey) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (error) {
      debugDraftLog("failed to persist draft", {
        storageKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [draft, storageKey]);

  return useMemo(
    () => ({
      draft,
      setDraft,
      patchDraft,
      hydrateFromServer,
      clearPersistedDraft,
    }),
    [clearPersistedDraft, draft, hydrateFromServer, patchDraft],
  );
}
