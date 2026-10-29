import assert from "node:assert/strict";
import { rankCandidatesForLimit, type ActivityCandidate } from "./event-candidate-search";

function activity(id: string, title: string): ActivityCandidate {
  return {
    id,
    title,
    shortDesc: "",
    type: "EVENT",
    scheduleMode: "MULTI_DATE",
    status: "PUBLISHED",
    nextOccurrenceAt: null,
    cityId: null,
    placeId: "p1",
    venueTitle: null,
    venueAddress: null,
  };
}

// 20 несвязанных событий площадки пришли раньше точного совпадения по названию:
// совпадение не должно потеряться при обрезке по лимиту.
{
  const unrelated = Array.from({ length: 20 }, (_, i) => activity(`u${i}`, `Другое событие номер ${i}`));
  const exact = activity("exact", "🎌 Фестиваль Аниме (12+)");
  const ranked = rankCandidatesForLimit([...unrelated, exact], "Фестиваль Аниме", 20);
  assert.equal(ranked.length, 20);
  assert.equal(ranked[0].id, "exact");
}

// Равная похожесть: сохраняется порядок поступления.
{
  const a = activity("a", "Одно");
  const b = activity("b", "Другое");
  assert.deepEqual(rankCandidatesForLimit([a, b], "Третье", 5).map((c) => c.id), ["a", "b"]);
}

// Без названия записи просто обрезаем по лимиту.
{
  const list = Array.from({ length: 5 }, (_, i) => activity(`x${i}`, `T${i}`));
  assert.equal(rankCandidatesForLimit(list, undefined, 3).length, 3);
}

console.log("event-candidate-ranking tests: OK");
