import { CaptureDraftSchema, type CaptureDraft } from "./captureDraft.schema";

export function entry(over: Record<string, unknown> = {}) {
  return {
    entryType: "EVENT",
    title: { value: "Экскурсия в музей", state: "stated" },
    child: { childId: null, raw: null, state: "missing" },
    startsAt: { value: "2026-10-09T09:30:00+03:00", state: "stated", basis: null },
    arriveAt: { value: null, state: "missing" },
    endsAt: { value: null, state: "missing" },
    dueAt: { value: null, hasTime: false, state: "missing" },
    location: { value: null, placeId: null, state: "missing" },
    requirements: [],
    notes: null,
    ...over,
  };
}

export function draft(over: Record<string, unknown> = {}): CaptureDraft {
  return CaptureDraftSchema.parse({
    intent: "CREATE",
    entries: [entry()],
    match: { candidatePlanItemId: null, changes: [] },
    ...over,
  });
}
