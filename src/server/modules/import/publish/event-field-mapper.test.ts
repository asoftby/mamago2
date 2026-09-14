import assert from "node:assert/strict";

import { mapNormalizedToActivity } from "./event-field-mapper";
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

  console.log("event-field-mapper tests: OK");
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
