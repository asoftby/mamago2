import type { EventFormData, EventWizardMode } from "./types";

/**
 * v1 marks drafts created after the occasion hydration fix. Legacy snapshots
 * were saved when the server omitted occasionLinks, so their occasionIds
 * cannot be trusted; all other unsaved fields are still worth preserving.
 */
const DRAFT_FORMAT_VERSION = 1;

export function serializeEventEditorDraft(draft: EventFormData): string {
  return JSON.stringify({ version: DRAFT_FORMAT_VERSION, draft });
}

export function parseEventEditorDraft(
  raw: string,
  serverDraft: EventFormData,
  mode: EventWizardMode,
): EventFormData | null {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  if ("version" in record) {
    if (record.version !== DRAFT_FORMAT_VERSION) return null;
    const stored = record.draft;
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
    const draft = stored as EventFormData;
    return {
      ...draft,
      occasionIds: Array.isArray(draft.occasionIds)
        ? draft.occasionIds.filter((id): id is string => typeof id === "string")
        : [...serverDraft.occasionIds],
    };
  }

  // Previous builds persisted raw EventFormData with occasionIds: [] even
  // for events that had occasion links. Restore only that unreliable field.
  const legacyDraft = record as EventFormData;
  return {
    ...legacyDraft,
    occasionIds: mode === "edit"
      ? [...serverDraft.occasionIds]
      : Array.isArray(legacyDraft.occasionIds)
        ? legacyDraft.occasionIds.filter((id): id is string => typeof id === "string")
        : [],
  };
}
