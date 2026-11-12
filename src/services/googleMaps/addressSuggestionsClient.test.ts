/**
 * Поведение адаптера Places API (New) на подменной библиотеке (без ключа Google):
 * сессия/токен, гонка ответов, поля fetchFields, форма координат.
 * Запуск: npx tsx src/services/googleMaps/addressSuggestionsClient.test.ts
 */
import assert from "node:assert/strict";
import {
  createAddressSuggestionsSession,
  fetchAddressSuggestions,
  resolveAddressSuggestion,
} from "./addressSuggestionsClient";

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };
const defer = <T,>(): Deferred<T> => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

function makeFakeLib() {
  const requests: Array<{ input: string; sessionToken: unknown; language?: string; region?: string }> = [];
  const tokens: object[] = [];
  const pending = new Map<string, Deferred<{ suggestions: unknown[] }>>();
  const fetchFieldsCalls: Array<Record<string, unknown>> = [];
  let failFetchFields = false;
  let location: unknown = { lat: () => 53.9, lng: () => 27.5 };

  const prediction = (placeId: string, main: string) => ({
    placeId,
    mainText: { text: main, matches: [{ startOffset: 0, endOffset: 3 }] },
    secondaryText: { text: "Минск" },
    toPlace: () => ({
      id: placeId,
      get location() { return location; },
      formattedAddress: `${main}, Минск`,
      addressComponents: [{ longText: "Минск", shortText: "Минск", types: ["locality"] }],
      fetchFields: async (arg: Record<string, unknown>) => {
        fetchFieldsCalls.push(arg);
        if (failFetchFields) throw new Error("fetchFields failed");
      },
    }),
  });

  const AutocompleteSuggestion = {
    async fetchAutocompleteSuggestions(this: unknown, request: { input: string; sessionToken: unknown; language?: string; region?: string }) {
      // Реальный API вызывается как метод класса: потеря `this` была бы ошибкой.
      assert.equal(this, AutocompleteSuggestion, "called as a method of AutocompleteSuggestion");
      requests.push(request);
      const gate = pending.get(request.input);
      return gate ? gate.promise : { suggestions: [] };
    },
  };
  class AutocompleteSessionToken { constructor() { tokens.push(this); } }

  return {
    lib: { AutocompleteSuggestion, AutocompleteSessionToken } as never,
    requests, tokens, pending, fetchFieldsCalls, prediction,
    setFail: (v: boolean) => { failFetchFields = v; },
    setLocation: (v: unknown) => { location = v; },
  };
}

async function main() {
  // ── 1. Один токен на сессию (а не на запрос), параметры запроса ─────────────
  {
    const f = makeFakeLib();
    const load = async () => f.lib;
    const session = createAddressSuggestionsSession();
    await fetchAddressSuggestions(session, "пр", load);
    await fetchAddressSuggestions(session, "при", load);
    await fetchAddressSuggestions(session, "прит", load);
    assert.equal(f.tokens.length, 1, "one AutocompleteSessionToken for the whole search session");
    assert.ok(f.requests.every((r) => r.sessionToken === f.tokens[0]), "every request carries the same token");
    assert.deepEqual([f.requests[0].language, f.requests[0].region], ["ru", "by"]);
  }

  // ── 2. Гонка: устаревший ответ не стирает подсказки, которые видит пользователь ──
  {
    const f = makeFakeLib();
    const load = async () => f.lib;
    const session = createAddressSuggestionsSession();
    const gateA = defer<{ suggestions: unknown[] }>();
    const gateB = defer<{ suggestions: unknown[] }>();
    f.pending.set("при", gateA);
    f.pending.set("прит", gateB);

    const a = fetchAddressSuggestions(session, "при", load); // медленный, устаревший
    const b = fetchAddressSuggestions(session, "прит", load); // быстрый, актуальный
    await new Promise((r) => setTimeout(r, 0));
    gateB.resolve({ suggestions: [{ placePrediction: f.prediction("only-b", "Притыцкого 12") }] });
    const viewsB = await b;
    gateA.resolve({ suggestions: [{ placePrediction: f.prediction("only-a", "Приозёрная 1") }] });
    await a; // UI отбросит этот ответ, но адаптер не должен испортить карту

    assert.deepEqual(viewsB.map((v) => v.id), ["only-b"]);
    const place = await resolveAddressSuggestion(session, "only-b");
    assert.ok(place, "a suggestion from the visible (newer) list is still selectable after a stale response");
    assert.equal(place.googlePlaceId, "only-b");
  }

  // ── 3. fetchFields: поля Essentials, без токена; токен сбрасывается при любом исходе ──
  {
    const f = makeFakeLib();
    const load = async () => f.lib;
    const session = createAddressSuggestionsSession();
    f.pending.set("прит", Object.assign(defer<{ suggestions: unknown[] }>(), {}));
    f.pending.get("прит")!.resolve({ suggestions: [{ placePrediction: f.prediction("p1", "Притыцкого 12") }] });

    await fetchAddressSuggestions(session, "прит", load);
    assert.ok(session.token, "token exists during the search session");
    const place = await resolveAddressSuggestion(session, "p1");

    assert.deepEqual(f.fetchFieldsCalls, [{ fields: ["id", "formattedAddress", "location", "addressComponents"] }], "only Essentials fields, and no sessionToken");
    assert.equal(session.token, undefined, "token discarded after the selection (session ended by fetchFields)");
    assert.equal(place?.displayName, "Притыцкого 12", "label comes from the prediction (displayName is a Pro field)");
    assert.equal(place?.formattedAddress, "Притыцкого 12, Минск");
    assert.deepEqual([place?.lat, place?.lng], [53.9, 27.5], "LatLng objects with lat()/lng() methods are read");

    // следующий поиск — с новым токеном
    const firstToken = f.tokens[0];
    await fetchAddressSuggestions(createAddressSuggestionsSession(), "прит", load);
    assert.notEqual(f.tokens[1], firstToken);
  }

  // ── 4. fetchFields упал: токен всё равно сброшен, подсказки остаются для повторного выбора ──
  {
    const f = makeFakeLib();
    const load = async () => f.lib;
    const session = createAddressSuggestionsSession();
    f.pending.set("прит", defer<{ suggestions: unknown[] }>());
    f.pending.get("прит")!.resolve({ suggestions: [{ placePrediction: f.prediction("p1", "Притыцкого 12") }, { placePrediction: f.prediction("p2", "Притыцкого 29") }] });
    await fetchAddressSuggestions(session, "прит", load);

    f.setFail(true);
    await assert.rejects(() => resolveAddressSuggestion(session, "p1"), /fetchFields failed/);
    assert.equal(session.token, undefined, "an ended session's token is never reused, even when fetchFields throws");
    assert.ok(session.predictions.has("p2"), "other suggestions stay selectable");

    f.setFail(false);
    const retry = await resolveAddressSuggestion(session, "p2");
    assert.equal(retry?.googlePlaceId, "p2");
  }

  // ── 5. Формы координат: числа; пустые/некорректные → null (адрес не выбирается) ──
  {
    const f = makeFakeLib();
    const load = async () => f.lib;
    const make = async () => {
      const session = createAddressSuggestionsSession();
      f.pending.set("x", defer<{ suggestions: unknown[] }>());
      f.pending.get("x")!.resolve({ suggestions: [{ placePrediction: f.prediction("p1", "Адрес") }] });
      await fetchAddressSuggestions(session, "x", load);
      return session;
    };
    f.setLocation({ lat: 10, lng: 20 });
    assert.deepEqual(await resolveAddressSuggestion(await make(), "p1").then((p) => [p?.lat, p?.lng]), [10, 20], "plain numbers");
    f.setLocation(null);
    assert.equal(await resolveAddressSuggestion(await make(), "p1"), null, "no location → no selection");
    f.setLocation({ lat: () => Number.NaN, lng: () => 1 });
    assert.equal(await resolveAddressSuggestion(await make(), "p1"), null, "non-finite coordinates → no selection");
    assert.equal(await resolveAddressSuggestion(createAddressSuggestionsSession(), "missing"), null, "unknown suggestion id");
  }

  console.log("addressSuggestionsClient.test.ts: OK");
}

void main();
