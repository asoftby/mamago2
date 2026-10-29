import assert from "node:assert/strict";
import { scoreEventCandidate } from "./event-match-scorer";
import type { ActivityCandidate } from "./event-candidate-search";
import { determineEventSuggestedAction, STRONG_TIME_TOLERANCE_MINUTES } from "./event-suggested-action";
import type { NormalizedEventImport } from "../types";

function normalized(overrides: Partial<NormalizedEventImport> = {}): NormalizedEventImport {
  return {
    entityType: "EVENT",
    sourceSlug: "tg",
    sourceUrl: "https://t.me/s/minsk_kids/1",
    title: "Фестиваль Аниме",
    venueName: "Фудмолл Конкорс",
    addressText: "ул. Бобруйская, 6",
    categoryCandidates: [],
    imageUrls: [],
    ...overrides,
  };
}

function candidate(overrides: Partial<ActivityCandidate> = {}): ActivityCandidate {
  return {
    id: "a1",
    title: "Фестиваль Аниме",
    shortDesc: "",
    type: "EVENT",
    scheduleMode: "MULTI_DATE",
    status: "PUBLISHED",
    nextOccurrenceAt: null,
    cityId: "minsk",
    placeId: "p1",
    venueTitle: "Фудмолл Конкорс",
    venueAddress: "Бобруйская 6",
    ...overrides,
  };
}

// Сеанс кандидата совпадает с датой записи, хотя nextOccurrenceAt далеко.
{
  const result = scoreEventCandidate(
    normalized({ startAt: "2026-11-07T15:00:00+03:00" }),
    candidate({
      nextOccurrenceAt: new Date("2026-10-31T12:00:00Z"),
      sessionStarts: [new Date("2026-10-31T12:00:00Z"), new Date("2026-11-07T12:00:00Z")],
    }),
  );
  assert.equal(result.signals.startDateDeltaDays, 0);
  assert.equal(result.signals.startTimeDeltaMinutes, 0);
}

// Время совпало с допуском и не совпало.
{
  const near = scoreEventCandidate(
    normalized({ startAt: "2026-11-07T15:20:00+03:00" }),
    candidate({ sessionStarts: [new Date("2026-11-07T12:00:00Z")] }),
  );
  assert.equal(near.signals.startTimeDeltaMinutes, 20);
  assert.ok((near.signals.startTimeDeltaMinutes ?? 99) <= STRONG_TIME_TOLERANCE_MINUTES);

  const far = scoreEventCandidate(
    normalized({ startAt: "2026-11-07T19:00:00+03:00" }),
    candidate({ sessionStarts: [new Date("2026-11-07T12:00:00Z")] }),
  );
  assert.equal(far.signals.startTimeDeltaMinutes, 240);
}

// Только дата без времени: сигнал времени не определён.
{
  const result = scoreEventCandidate(
    normalized({ startAt: "2026-11-07" }),
    candidate({ sessionStarts: [new Date("2026-11-07T12:00:00Z")] }),
  );
  assert.equal(result.signals.startTimeDeltaMinutes, null);
}

// Разные дни: время не сравнивается.
{
  const result = scoreEventCandidate(
    normalized({ startAt: "2026-11-09T15:00:00+03:00" }),
    candidate({ sessionStarts: [new Date("2026-11-07T12:00:00Z")] }),
  );
  assert.equal(result.signals.startTimeDeltaMinutes, null);
}

// Без sessionStarts поведение прежнее: считается только по nextOccurrenceAt.
{
  const result = scoreEventCandidate(
    normalized({ startAt: "2026-11-07T15:00:00+03:00" }),
    candidate({ nextOccurrenceAt: new Date("2026-11-07T12:00:00Z") }),
  );
  assert.equal(result.signals.startDateDeltaDays, 0);
}

// Эмодзи и возрастная метка не ломают сравнение названий.
{
  const result = scoreEventCandidate(
    normalized({ title: "🎌 Фестиваль Аниме (12+)", startAt: "2026-11-07T15:00:00+03:00" }),
    candidate({ sessionStarts: [new Date("2026-11-07T12:00:00Z")] }),
  );
  assert.equal(result.signals.titleSimilarity, 1);
}

// Решение: сильное совпадение остаётся UPDATE_EXISTING, если время сошлось или неизвестно.
{
  const strong = scoreEventCandidate(
    normalized({ startAt: "2026-11-07T15:10:00+03:00" }),
    candidate({ sessionStarts: [new Date("2026-11-07T12:00:00Z")] }),
  );
  const matched = determineEventSuggestedAction([strong], 0.8);
  assert.equal(matched.matchStatus, "MATCHED");
  assert.equal(matched.suggestedAction, "UPDATE_EXISTING");

  const noTime = scoreEventCandidate(
    normalized({ startAt: "2026-11-07" }),
    candidate({ sessionStarts: [new Date("2026-11-07T12:00:00Z")] }),
  );
  assert.equal(determineEventSuggestedAction([noTime], 0.8).suggestedAction, "UPDATE_EXISTING");
}

// Тот же день, другое время: не обновление, а решение редактора.
{
  const differentTime = scoreEventCandidate(
    normalized({ startAt: "2026-11-07T19:00:00+03:00" }),
    candidate({ sessionStarts: [new Date("2026-11-07T12:00:00Z")] }),
  );
  const decision = determineEventSuggestedAction([differentTime], 0.8);
  assert.equal(decision.matchStatus, "AMBIGUOUS");
  assert.equal(decision.suggestedAction, "MERGE");
  assert.match(decision.reason, /start time differs/);
}

console.log("event-match-sessions tests: OK");
