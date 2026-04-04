/** JSON-сессия: шаг возврата в редактор (без query `step`). */
export const EVENT_EDITOR_SESSION_KEY = "mg.eventEdit.session";
/** @deprecated совместимость чтения; новая запись идёт в EVENT_EDITOR_SESSION_KEY */
export const EVENT_EDITOR_RETURN_STEP_KEY = "mg.eventEdit.returnStep";

type SessionV1 = {
  v: 1;
  eventId: string;
  returnStep: number;
};

function parseSession(raw: string | null): SessionV1 | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as SessionV1;
    if (p?.v === 1 && typeof p.eventId === "string" && typeof p.returnStep === "number") {
      return p;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readSessionForEvent(eventId: string): SessionV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const p = parseSession(sessionStorage.getItem(EVENT_EDITOR_SESSION_KEY));
    if (p && p.eventId === eventId) return p;

    const rawLegacy = sessionStorage.getItem(EVENT_EDITOR_RETURN_STEP_KEY);
    if (rawLegacy) {
      const idx = rawLegacy.indexOf(":");
      if (idx > 0) {
        const id = rawLegacy.slice(0, idx);
        const st = rawLegacy.slice(idx + 1);
        if (id === eventId) {
          const n = parseInt(st, 10);
          if (!Number.isNaN(n)) {
            const migrated: SessionV1 = { v: 1, eventId, returnStep: n };
            sessionStorage.setItem(EVENT_EDITOR_SESSION_KEY, JSON.stringify(migrated));
            sessionStorage.removeItem(EVENT_EDITOR_RETURN_STEP_KEY);
            return migrated;
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setEventEditorSession(eventId: string, payload: { returnStep: number }): void {
  if (typeof window === "undefined") return;
  try {
    const data: SessionV1 = {
      v: 1,
      eventId,
      returnStep: payload.returnStep,
    };
    sessionStorage.setItem(EVENT_EDITOR_SESSION_KEY, JSON.stringify(data));
    sessionStorage.removeItem(EVENT_EDITOR_RETURN_STEP_KEY);
  } catch {
    /* ignore */
  }
}

export function clearEventEditorReturnStep(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(EVENT_EDITOR_SESSION_KEY);
    sessionStorage.removeItem(EVENT_EDITOR_RETURN_STEP_KEY);
  } catch {
    /* ignore */
  }
}

export function readEventEditorReturnStep(eventId: string): number | null {
  const s = readSessionForEvent(eventId);
  return s?.returnStep ?? null;
}

export function editHrefWithStoredStep(eventId: string, baseEditHref: string): string {
  const n = readEventEditorReturnStep(eventId);
  if (n == null || n < 1) return baseEditHref;
  return `${baseEditHref}?step=${encodeURIComponent(String(n))}`;
}
