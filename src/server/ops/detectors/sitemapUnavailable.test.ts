/**
 * sitemap_unavailable detector tests (§21 Step 4, Phase C).
 * Pure evaluate() tests need no network/DB. The escalation test proves the
 * mandatory live exercise of Step 3's severity-mutation lifecycle against
 * real PostgreSQL.
 *
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/detectors/sitemapUnavailable.test.ts
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import { reconcileDetectorSignals } from "../reconciliation";
import {
  evaluateSitemapUnavailable,
  parseSitemapEntryCount,
  SITEMAP_FINGERPRINT,
  type SitemapProbeOutcome,
} from "./sitemapUnavailable";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const VALID_SITEMAP_WITH_ENTRIES = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/a</loc></url>
  <url><loc>https://example.com/b</loc></url>
</urlset>`;

const VALID_EMPTY_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;

const VALID_SITEMAPINDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap>
</sitemapindex>`;

const INVALID_XML = `<urlset><url><loc>unterminated`;

// ── pure tests ───────────────────────────────────────────────────────────

assert.equal(parseSitemapEntryCount(VALID_SITEMAP_WITH_ENTRIES), 2);
assert.equal(parseSitemapEntryCount(VALID_EMPTY_SITEMAP), 0);
assert.equal(parseSitemapEntryCount(VALID_SITEMAPINDEX), 1);
assert.equal(parseSitemapEntryCount(INVALID_XML), null);
assert.equal(parseSitemapEntryCount("not xml at all { }"), null);

function expectSeverity(outcome: SitemapProbeOutcome, expected: "CRITICAL" | "WARNING" | null) {
  const result = evaluateSitemapUnavailable(outcome);
  if (expected === null) {
    assert.deepEqual(result.signals, []);
    return;
  }
  assert.equal(result.signals.length, 1);
  assert.equal(result.signals[0].severity, expected);
  assert.equal(result.signals[0].fingerprint, SITEMAP_FINGERPRINT);
}

expectSeverity({ kind: "timeout" }, "CRITICAL");
expectSeverity({ kind: "network_error", message: "ECONNREFUSED" }, "CRITICAL");
expectSeverity({ kind: "http_5xx", httpStatus: 500 }, "CRITICAL");
expectSeverity({ kind: "http_5xx", httpStatus: 503 }, "CRITICAL");
expectSeverity({ kind: "http_other", httpStatus: 404 }, "WARNING");
expectSeverity({ kind: "parsed", httpStatus: 200, body: INVALID_XML }, "WARNING");
expectSeverity({ kind: "parsed", httpStatus: 200, body: VALID_EMPTY_SITEMAP }, "WARNING");
expectSeverity({ kind: "parsed", httpStatus: 200, body: VALID_SITEMAP_WITH_ENTRIES }, null);

console.log("sitemapUnavailable.test.ts (pure): OK");

// ── mandatory severity escalation integration test ──────────────────────

async function testSeverityEscalation() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  const detector = "sitemap_unavailable";

  try {
    await prisma.operationalSignal.deleteMany({ where: { detector } });

    // 1. Open a WARNING incident (empty sitemap) — needs 2 hits to OPEN.
    const emptySignals = evaluateSitemapUnavailable({
      kind: "parsed",
      httpStatus: 200,
      body: VALID_EMPTY_SITEMAP,
    }).signals;
    await reconcileDetectorSignals(prisma, detector, emptySignals);
    await reconcileDetectorSignals(prisma, detector, emptySignals);

    const open = await prisma.operationalSignal.findFirstOrThrow({
      where: { detector, fingerprint: SITEMAP_FINGERPRINT, resolvedAt: null },
    });
    assert.equal(open.status, "OPEN");
    assert.equal(open.severity, "WARNING");
    const openedAtBefore = open.openedAt;

    // 2. Acknowledge + snooze it.
    await prisma.operationalSignal.update({
      where: { id: open.id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: "admin-test",
        snoozedUntil: new Date(Date.now() + 3_600_000),
      },
    });
    const acked = await prisma.operationalSignal.findUniqueOrThrow({ where: { id: open.id } });
    const attentionChangedAtBefore = acked.attentionChangedAt;

    await new Promise((r) => setTimeout(r, 5));

    // 3. Next successful detector result reports the SAME fingerprint,
    // now CRITICAL (e.g. the sitemap host started timing out).
    const criticalSignals = evaluateSitemapUnavailable({ kind: "timeout" }).signals;
    assert.equal(criticalSignals[0].fingerprint, SITEMAP_FINGERPRINT, "same fingerprint, not a new one");
    await reconcileDetectorSignals(prisma, detector, criticalSignals);

    const escalated = await prisma.operationalSignal.findUniqueOrThrow({ where: { id: open.id } });
    assert.equal(escalated.id, open.id, "same incident id");
    assert.equal(escalated.status, "OPEN");
    assert.equal(escalated.severity, "CRITICAL");
    assert.equal(escalated.openedAt?.getTime(), openedAtBefore?.getTime(), "openedAt unchanged");
    assert.ok(
      escalated.attentionChangedAt!.getTime() > attentionChangedAtBefore!.getTime(),
      "attentionChangedAt advanced",
    );
    assert.equal(escalated.acknowledgedAt, null, "ack cleared");
    assert.equal(escalated.acknowledgedBy, null, "ack cleared");
    assert.equal(escalated.snoozedUntil, null, "snooze cleared");

    // 4. Verify CRITICAL -> WARNING asymmetry too: ack/snooze again, then
    // de-escalate back to WARNING (e.g. sitemap now returns but empty).
    await prisma.operationalSignal.update({
      where: { id: open.id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: "admin-test-2",
        snoozedUntil: new Date(Date.now() + 3_600_000),
      },
    });
    const reAcked = await prisma.operationalSignal.findUniqueOrThrow({ where: { id: open.id } });
    const attentionChangedAtBeforeDeescalation = reAcked.attentionChangedAt;

    await new Promise((r) => setTimeout(r, 5));

    await reconcileDetectorSignals(prisma, detector, emptySignals);
    const deescalated = await prisma.operationalSignal.findUniqueOrThrow({ where: { id: open.id } });
    assert.equal(deescalated.severity, "WARNING");
    assert.equal(
      deescalated.attentionChangedAt?.getTime(),
      attentionChangedAtBeforeDeescalation?.getTime(),
      "attentionChangedAt unchanged on de-escalation",
    );
    assert.ok(deescalated.acknowledgedAt, "ack preserved on de-escalation");
    assert.equal(deescalated.acknowledgedBy, "admin-test-2");
    assert.ok(deescalated.snoozedUntil, "snooze preserved on de-escalation");

    console.log("sitemapUnavailable.test.ts (severity escalation integration): OK");
  } finally {
    await prisma.operationalSignal.deleteMany({ where: { detector } });
    await prisma.$disconnect();
  }
}

testSeverityEscalation().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
