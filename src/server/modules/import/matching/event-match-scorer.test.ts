import assert from "node:assert/strict";

import { scoreEventCandidate } from "./event-match-scorer";
import type { ActivityCandidate } from "./event-candidate-search";
import type { NormalizedEventImport } from "../types";

function baseNormalized(overrides: Partial<NormalizedEventImport> = {}): NormalizedEventImport {
  return {
    entityType: "EVENT",
    sourceSlug: "test-source",
    sourceUrl: "https://example.com/event",
    title: "Кукольный спектакль «Теремок»",
    venueName: "Театр кукол",
    addressText: "ул. Энгельса, 26",
    categoryCandidates: [],
    imageUrls: [],
    ...overrides,
  };
}

function baseCandidate(overrides: Partial<ActivityCandidate> = {}): ActivityCandidate {
  return {
    id: "activity-1",
    title: "Кукольный спектакль «Теремок»",
    shortDesc: "",
    type: "EVENT",
    scheduleMode: "MULTI_DATE",
    status: "PUBLISHED",
    nextOccurrenceAt: null,
    cityId: "minsk",
    placeId: "place-1",
    venueTitle: "Театр кукол",
    venueAddress: "ул. Энгельса, 26",
    ...overrides,
  };
}

// ── family.by (no occurrences[]) — поведение не меняется: единственный
// кандидат даты — normalized.startAt, точный старый расчёт дельты/score.
{
  const normalized = baseNormalized({ startAt: "2026-07-01T10:00:00.000Z" });
  const candidate = baseCandidate({ nextOccurrenceAt: new Date("2026-07-01T10:00:00.000Z") });

  const result = scoreEventCandidate(normalized, candidate);

  assert.equal(result.signals.startDateDeltaDays, 0);
  assert.equal(result.signals.possibleOccurrenceRisk, false);
  assert.ok(result.score >= 0.9, `expected strong score for exact match, got ${result.score}`);
}

{
  // family.by, дата совпадающего кандидата далеко — дельта считается от
  // единственного startAt, как и до изменения (regression guard).
  const normalized = baseNormalized({ startAt: "2026-07-01T10:00:00.000Z" });
  const candidate = baseCandidate({ nextOccurrenceAt: new Date("2026-09-01T10:00:00.000Z") });

  const result = scoreEventCandidate(normalized, candidate);

  assert.equal(result.signals.startDateDeltaDays, 62);
  assert.equal(result.signals.possibleOccurrenceRisk, true);
}

// ── ABWS (occurrences[]) — best-effort normalized.startAt = первый сеанс,
// далёкий от кандидата, но один из ПОЗДНИХ сеансов совпадает точно.
// Дельта должна считаться по МИНИМУМУ среди occurrences[], не по startAt.
{
  const normalized = baseNormalized({
    // best-effort "первый" сеанс — намеренно далеко от кандидата
    startAt: "2026-05-01T10:00:00.000Z",
    occurrences: [
      { startAt: "2026-05-01T10:00:00.000Z", venueName: "Театр кукол" },
      { startAt: "2026-07-01T10:00:00.000Z", venueName: "Театр кукол" },
      { startAt: "2026-08-15T10:00:00.000Z", venueName: "Театр кукол" },
    ],
  });
  const candidate = baseCandidate({ nextOccurrenceAt: new Date("2026-07-01T10:00:00.000Z") });

  const result = scoreEventCandidate(normalized, candidate);

  assert.equal(
    result.signals.startDateDeltaDays,
    0,
    "должен взять минимальную дельту по occurrences[], а не по best-effort startAt",
  );
  assert.equal(result.signals.possibleOccurrenceRisk, false);
  assert.ok(result.score >= 0.9, `expected strong score via occurrence match, got ${result.score}`);
}

// ── Искусственно заведённый конфликт партнёрского события: title+venue
// совпадают, но НИ ОДИН сеанс из occurrences[] не близок к кандидату —
// должен остаться possibleOccurrenceRisk=true с ненулевыми
// venueSimilarity и startDateDeltaDays (критерий приёмки из плана).
{
  const normalized = baseNormalized({
    startAt: "2026-01-10T10:00:00.000Z",
    occurrences: [
      { startAt: "2026-01-10T10:00:00.000Z", venueName: "Театр кукол" },
      { startAt: "2026-02-20T10:00:00.000Z", venueName: "Театр кукол" },
    ],
  });
  const candidate = baseCandidate({ nextOccurrenceAt: new Date("2026-07-01T10:00:00.000Z") });

  const result = scoreEventCandidate(normalized, candidate);

  assert.ok(result.signals.venueSimilarity > 0, "venueSimilarity должен быть ненулевым");
  assert.ok(
    result.signals.startDateDeltaDays != null && result.signals.startDateDeltaDays > 0,
    "startDateDeltaDays должен быть ненулевым",
  );
  assert.equal(result.signals.possibleOccurrenceRisk, true);
}

// ── occurrences[] присутствует, но пуст, и записи без startAt отфильтровываются
// — падаем обратно на normalized.startAt, а не на "нет данных о дате".
{
  const normalizedEmpty = baseNormalized({
    startAt: "2026-07-01T10:00:00.000Z",
    occurrences: [],
  });
  const candidate = baseCandidate({ nextOccurrenceAt: new Date("2026-07-01T10:00:00.000Z") });

  const resultEmpty = scoreEventCandidate(normalizedEmpty, candidate);
  assert.equal(resultEmpty.signals.startDateDeltaDays, 0);

  const normalizedNoStartAt = baseNormalized({
    startAt: "2026-07-01T10:00:00.000Z",
    occurrences: [{ venueName: "Театр кукол" }, { venueName: "Театр кукол" }],
  });
  const resultNoStartAt = scoreEventCandidate(normalizedNoStartAt, candidate);
  assert.equal(
    resultNoStartAt.signals.startDateDeltaDays,
    0,
    "occurrences без startAt отфильтровываются, используется normalized.startAt",
  );
}

console.log("event-match-scorer tests: OK");
