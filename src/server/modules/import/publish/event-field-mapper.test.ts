import assert from "node:assert/strict";

import {
  mapNormalizedToActivity,
  filterActivityNonDestructiveUpdates,
  isPlaceholderZeroPriceFrom,
} from "./event-field-mapper";
import type { NormalizedEventImport } from "../types";

function baseNormalized(overrides: Partial<NormalizedEventImport> = {}): NormalizedEventImport {
  return {
    entityType: "EVENT",
    sourceSlug: "abws",
    sourceUrl: "https://24afisha.by/event/1",
    title: "Кукольный спектакль «Теремок»",
    shortDescCandidate: "Кукольный спектакль для всей семьи",
    typeCandidate: "EVENT",
    scheduleModeCandidate: "ONE_TIME",
    categoryCandidates: [],
    imageUrls: [],
    ...overrides,
  };
}

async function unwrap(nd: NormalizedEventImport) {
  const result = await mapNormalizedToActivity(nd, null);
  assert.ok(!("error" in result), `expected success, got error: ${"error" in result ? result.error : ""}`);
  return result as Extract<typeof result, { fields: unknown }>;
}

// ── price: min across occurrences, converted kopecks -> rubles, "from" mode ──
(async () => {
  const { fields } = await unwrap(
    baseNormalized({
      occurrences: [
        { externalId: "1", startAt: "2026-07-01T10:00:00.000Z", priceMinCents: 2500 },
        { externalId: "2", startAt: "2026-07-05T10:00:00.000Z", priceMinCents: 500 },
        { externalId: "3", startAt: "2026-07-10T10:00:00.000Z", priceMinCents: 1200 },
      ],
    }),
  );

  assert.equal(fields.priceFrom, 5, "5.00 BYN — the minimum across all three sessions, in rubles");
  assert.equal(fields.priceMode, "FROM");
  assert.equal(fields.priceTo, undefined, "\"цена от\", not a range — priceTo must stay unset");
  assert.equal(
    (fields.scheduleJson as { pricingMode?: string } | undefined)?.pricingMode,
    "from",
  );

  // ── some occurrences missing priceMinCents — min computed from the rest, no throw ──
  const { fields: fields2, warnings: warnings2 } = await unwrap(
    baseNormalized({
      occurrences: [
        { externalId: "1", startAt: "2026-07-01T10:00:00.000Z", priceMinCents: null },
        { externalId: "2", startAt: "2026-07-05T10:00:00.000Z", priceMinCents: 800 },
        { externalId: "3", startAt: "2026-07-10T10:00:00.000Z" },
      ],
    }),
  );
  assert.equal(fields2.priceFrom, 8);
  assert.equal(fields2.priceMode, "FROM");
  assert.ok(!warnings2.some((w) => w.includes("priceMinCents")), "partial nulls must not produce a price warning");

  // ── zero-priced occurrences excluded from the minimum — a real non-zero floor wins ──
  // (ABWS has a known false-zero rate — a 0 means "source didn't fill in a
  // price for this session", not "this session is free".)
  const { fields: fieldsZeroMixed, warnings: warningsZeroMixed } = await unwrap(
    baseNormalized({
      occurrences: [
        { externalId: "1", startAt: "2026-07-01T10:00:00.000Z", priceMinCents: 0 },
        { externalId: "2", startAt: "2026-07-05T10:00:00.000Z", priceMinCents: 4000 },
        { externalId: "3", startAt: "2026-07-10T10:00:00.000Z", priceMinCents: 0 },
      ],
    }),
  );
  assert.equal(fieldsZeroMixed.priceFrom, 40, "zero-priced sessions must not drag the minimum down to 0");
  assert.equal(fieldsZeroMixed.priceMode, "FROM");
  assert.ok(
    !warningsZeroMixed.some((w) => w.toLowerCase().includes("zero")),
    "a real non-zero floor exists — no warning needed",
  );

  // ── every occurrence with a price is exactly zero — no FREE fallback, price left untouched ──
  // "Free" is a distinct, confirmed signal (see normalizePublicationPrice's
  // own FREE mode) — the absence of a real price is not that signal, so
  // priceMode must NOT be silently set to FREE here.
  const { fields: fieldsAllZero, warnings: warningsAllZero } = await unwrap(
    baseNormalized({
      occurrences: [
        { externalId: "1", startAt: "2026-07-01T10:00:00.000Z", priceMinCents: 0 },
        { externalId: "2", startAt: "2026-07-05T10:00:00.000Z", priceMinCents: 0 },
      ],
    }),
  );
  assert.equal(fieldsAllZero.priceFrom, undefined, "all-zero occurrences are placeholder data, not a genuine free signal");
  assert.equal(fieldsAllZero.priceMode, undefined, "must not be silently set to FREE");
  assert.ok(warningsAllZero.some((w) => w.toLowerCase().includes("zero")));

  // ── all occurrences missing priceMinCents — no crash, price left empty, warning recorded ──
  const { fields: fields3, warnings: warnings3 } = await unwrap(
    baseNormalized({
      occurrences: [
        { externalId: "1", startAt: "2026-07-01T10:00:00.000Z", priceMinCents: null },
        { externalId: "2", startAt: "2026-07-05T10:00:00.000Z" },
      ],
    }),
  );
  assert.equal(fields3.priceFrom, undefined);
  assert.equal(fields3.priceMode, undefined);
  assert.ok(warnings3.some((w) => w.includes("priceMinCents")));

  // ── no occurrences at all (e.g. a performance with zero sessions) — untouched, no crash ──
  const { fields: fields4 } = await unwrap(baseNormalized());
  assert.equal(fields4.priceFrom, undefined);
  assert.equal(fields4.priceMode, undefined);

  // ── ticketLink from performanceBuyUrl (raw, unmodified — no lang/distributor_company_id added here) ──
  const { fields: fields5 } = await unwrap(
    baseNormalized({ performanceBuyUrl: "https://saleframe.24afisha.by/?pid=332622" }),
  );
  const sj5 = fields5.scheduleJson as { ticketLink?: string; participationMode?: string } | undefined;
  assert.equal(sj5?.ticketLink, "https://saleframe.24afisha.by/?pid=332622");
  assert.equal(sj5?.participationMode, "external-link");

  // ── no performanceBuyUrl — ticketLink/participationMode stay unset ──
  const { fields: fields6 } = await unwrap(baseNormalized());
  const sj6 = fields6.scheduleJson as { ticketLink?: string; participationMode?: string } | undefined;
  assert.equal(sj6?.ticketLink, undefined);
  assert.equal(sj6?.participationMode, undefined);

  // ── price + ticketLink together don't clobber each other in scheduleJson ──
  const { fields: fields7 } = await unwrap(
    baseNormalized({
      occurrences: [{ externalId: "1", startAt: "2026-07-01T10:00:00.000Z", priceMinCents: 1000 }],
      performanceBuyUrl: "https://saleframe.24afisha.by/?pid=1",
    }),
  );
  const sj7 = fields7.scheduleJson as Record<string, unknown>;
  assert.equal(sj7.pricingMode, "from");
  assert.equal(sj7.ticketLink, "https://saleframe.24afisha.by/?pid=1");
  assert.equal(sj7.participationMode, "external-link");

  // ── isPlaceholderZeroPriceFrom: the pre-#299 stale-zero backfill gap (Codex review finding) ──
  assert.equal(
    isPlaceholderZeroPriceFrom({ priceFrom: 0, priceMode: "FROM" }),
    true,
    "priceFrom 0 with a non-FREE mode is the known placeholder bug",
  );
  assert.equal(
    isPlaceholderZeroPriceFrom({ priceFrom: 0, priceMode: "UNKNOWN" }),
    true,
  );
  assert.equal(
    isPlaceholderZeroPriceFrom({ priceFrom: 0, priceMode: "FREE" }),
    false,
    "a genuinely free event legitimately has priceFrom 0 and must not be flagged",
  );
  assert.equal(
    isPlaceholderZeroPriceFrom({ priceFrom: 40, priceMode: "FROM" }),
    false,
    "a real non-zero priceFrom is never a placeholder",
  );
  assert.equal(
    isPlaceholderZeroPriceFrom({ priceFrom: null, priceMode: "UNKNOWN" }),
    false,
  );

  // ── filterActivityNonDestructiveUpdates: a corrected non-zero priceFrom must
  // overwrite a previously-stored placeholder-zero one, but never a real FREE 0 ──
  const mappedWithPrice = (priceFrom: number) =>
    ({
      title: "T",
      shortDesc: "S",
      type: "EVENT" as never,
      format: "OFFLINE" as never,
      scheduleMode: "ONE_TIME" as never,
      priceFrom,
    }) as Parameters<typeof filterActivityNonDestructiveUpdates>[0];

  const { updates: fixedZeroUpdates, skipped: fixedZeroSkipped } = filterActivityNonDestructiveUpdates(
    mappedWithPrice(40),
    { title: "T", shortDesc: "S", type: "EVENT", format: "OFFLINE", scheduleMode: "ONE_TIME", priceFrom: 0, priceMode: "FROM" },
  );
  assert.equal(fixedZeroUpdates.priceFrom, 40, "the corrected floor must replace the stale placeholder zero");
  assert.ok(!fixedZeroSkipped.includes("priceFrom"));

  const { updates: freeUpdates, skipped: freeSkipped } = filterActivityNonDestructiveUpdates(
    mappedWithPrice(40),
    { title: "T", shortDesc: "S", type: "EVENT", format: "OFFLINE", scheduleMode: "ONE_TIME", priceFrom: 0, priceMode: "FREE" },
  );
  assert.equal(freeUpdates.priceFrom, undefined, "a real free event's priceFrom 0 must not be overwritten");
  assert.ok(freeSkipped.includes("priceFrom"));

  const { updates: realPriceUpdates, skipped: realPriceSkipped } = filterActivityNonDestructiveUpdates(
    mappedWithPrice(10),
    { title: "T", shortDesc: "S", type: "EVENT", format: "OFFLINE", scheduleMode: "ONE_TIME", priceFrom: 40, priceMode: "FROM" },
  );
  assert.equal(realPriceUpdates.priceFrom, undefined, "an existing real, non-zero price is never overwritten by import");
  assert.ok(realPriceSkipped.includes("priceFrom"));

  console.log("event-field-mapper tests: OK");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
