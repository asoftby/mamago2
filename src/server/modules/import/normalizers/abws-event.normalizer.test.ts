import assert from "node:assert/strict";

import { computeAbwsQualityFlags, normalizeAbwsEventPayload } from "./abws-event.normalizer";
import type {
  AbwsPerformanceRawPayload,
  AbwsSessionRawPayload,
} from "../parsers/abws-performances-event.parser";

function baseSession(overrides: Partial<AbwsSessionRawPayload> = {}): AbwsSessionRawPayload {
  return {
    externalId: "session-1",
    startsAt: "2026-07-01T10:00:00.000Z",
    priceMinCents: 500,
    priceMaxCents: 800,
    buyUrl: "https://24afisha.by/buy/session-1",
    isSaleOpen: true,
    withdrawnAt: null,
    tags: [],
    type: "default",
    venue: { id: 1, name: "Театр кукол", address: "ул. Энгельса, 26", city: { slug: "minsk" } },
    citySlugMismatch: false,
    ...overrides,
  };
}

function basePayload(overrides: Partial<AbwsPerformanceRawPayload> = {}): AbwsPerformanceRawPayload {
  return {
    title: "Кукольный спектакль «Теремок»",
    description: "Описание спектакля",
    ageMin: 3,
    durationMinutes: 60,
    showFrom: null,
    showTo: null,
    images: [],
    perfPriceMinRub: null,
    perfPriceMaxRub: null,
    categoryTypeIds: [1],
    recognizedTypes: [{ id: 1, name: "Кино" }],
    unrecognizedTypes: [],
    perfBuyUrl: null,
    isSingleVenue: true,
    sessions: [baseSession()],
    llm: {
      category: null,
      categoryConfidence: null,
      categoryAlternatives: [],
      audience: null,
      audienceConfidence: null,
      ageMax: null,
      interests: [],
      occasions: [],
      description: null,
      flags: [],
    },
    ...overrides,
  };
}

// ── occurrences[] carries priceMinCents/priceMaxCents straight from the
// session payload, no round-trip through priceText.
{
  const result = normalizeAbwsEventPayload({
    sourceSlug: "abws",
    sourceUrl: "https://24afisha.by/event/1",
    rawPayload: basePayload({
      sessions: [baseSession({ priceMinCents: 250, priceMaxCents: 900 })],
    }) as unknown as Record<string, unknown>,
  });

  assert.equal(result.normalized.occurrences?.[0]?.priceMinCents, 250);
  assert.equal(result.normalized.occurrences?.[0]?.priceMaxCents, 900);
  assert.equal(result.normalized.occurrences?.[0]?.priceText, "2.50 BYN");
}

// ── categoryCandidates: human-readable "Name (id)", not bare numbers ──────
{
  const result = normalizeAbwsEventPayload({
    sourceSlug: "abws",
    sourceUrl: "https://24afisha.by/event/1",
    rawPayload: basePayload({
      categoryTypeIds: [1, 3],
      recognizedTypes: [
        { id: 1, name: "Кино" },
        { id: 3, name: "Театр" },
      ],
    }) as unknown as Record<string, unknown>,
  });

  assert.deepEqual(result.normalized.categoryCandidates, ["Кино (1)", "Театр (3)"]);
}

// ── categoryCandidates: backward-compat fallback to bare ids when
// recognizedTypes is absent — a stored rawPayload from before this field
// existed must not crash the normalizer, it just loses the name.
{
  const legacyPayload = basePayload({ categoryTypeIds: [1, 3] }) as unknown as Record<string, unknown>;
  delete legacyPayload.recognizedTypes;

  const result = normalizeAbwsEventPayload({
    sourceSlug: "abws",
    sourceUrl: "https://24afisha.by/event/1",
    rawPayload: legacyPayload,
  });

  assert.deepEqual(result.normalized.categoryCandidates, ["1", "3"]);
}

// ── otherCategoryCandidates: everything outside CATEGORY_TYPE_IDS, with
// names — never auto-mapped, but visible to the reviewer instead of
// silently dropped (Театр кукол / Детям use case).
{
  const result = normalizeAbwsEventPayload({
    sourceSlug: "abws",
    sourceUrl: "https://24afisha.by/event/1",
    rawPayload: basePayload({
      unrecognizedTypes: [
        { id: 53, name: "Театр кукол" },
        { id: 18, name: "Детям" },
        { id: 999, name: null },
      ],
    }) as unknown as Record<string, unknown>,
  });

  assert.deepEqual(result.normalized.otherCategoryCandidates, [
    "Театр кукол (53)",
    "Детям (18)",
    "999",
  ]);
}

// ── otherCategoryCandidates: absent entirely (not an empty array) when
// there is nothing unrecognized — matches categoryCandidates' own
// "no noise" case, keeps the field optional/undefined as documented.
{
  const result = normalizeAbwsEventPayload({
    sourceSlug: "abws",
    sourceUrl: "https://24afisha.by/event/1",
    rawPayload: basePayload({ unrecognizedTypes: [] }) as unknown as Record<string, unknown>,
  });

  assert.equal(result.normalized.otherCategoryCandidates, undefined);
}

// ── qualityFlags: ничего не сработало — все три ключа явно false,
// не отсутствуют и не null.
{
  const flags = computeAbwsQualityFlags(basePayload());
  assert.deepEqual(flags, { multiVenue: false, belowPriceFloor: false, nonMinskCity: false });
}

// ── multiVenue: !isSingleVenue
{
  const flags = computeAbwsQualityFlags(basePayload({ isSingleVenue: false }));
  assert.equal(flags.multiVenue, true);
  assert.equal(flags.belowPriceFloor, false);
  assert.equal(flags.nonMinskCity, false);
}

// ── belowPriceFloor: любой сеанс дешевле 1.00 BYN (100 копеек)
{
  const flags = computeAbwsQualityFlags(
    basePayload({
      sessions: [baseSession({ priceMinCents: 500 }), baseSession({ priceMinCents: 0 })],
    }),
  );
  assert.equal(flags.belowPriceFloor, true);
}

// ── belowPriceFloor: без сессий — fallback на perfPriceMinRub (рубли, не копейки)
{
  const flagsLow = computeAbwsQualityFlags(
    basePayload({ sessions: [], perfPriceMinRub: 0 }),
  );
  assert.equal(flagsLow.belowPriceFloor, true);

  const flagsOk = computeAbwsQualityFlags(
    basePayload({ sessions: [], perfPriceMinRub: 5 }),
  );
  assert.equal(flagsOk.belowPriceFloor, false);
}

// ── nonMinskCity: город сеанса ≠ "minsk"
{
  const flags = computeAbwsQualityFlags(
    basePayload({
      sessions: [baseSession({ venue: { id: 1, name: "Дворец", address: null, city: { slug: "gomel" } } })],
    }),
  );
  assert.equal(flags.nonMinskCity, true);
}

// ── nonMinskCity: город неизвестен — считаем НЕ подтверждённым Минском (true),
// а не молчаливым допущением, что это Минск.
{
  const flags = computeAbwsQualityFlags(
    basePayload({ sessions: [baseSession({ venue: null })] }),
  );
  assert.equal(flags.nonMinskCity, true);
}

console.log("abws-event.normalizer tests: OK");
