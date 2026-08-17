/**
 * funnel collector tests (§21 Step 5, Phase P).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/funnel.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, type UserEventType } from "@prisma/client";

import { collectFunnelMetrics } from "./funnel";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const createdEventIds: string[] = [];

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeEvent(eventType: UserEventType, createdAt: Date) {
    const event = await prisma.userEvent.create({ data: { eventType, createdAt, sessionId: `funnel-${marker}` } });
    createdEventIds.push(event.id);
  }

  try {
    const now = new Date("2026-08-17T12:00:00.000Z");
    const inWindow = new Date(now.getTime() - 5 * 60 * 1000);
    const outsideWindow = new Date(now.getTime() - 20 * 60 * 1000);

    await makeEvent("DETAIL_OPEN", inWindow);
    await makeEvent("DETAIL_OPEN", inWindow);
    await makeEvent("SAVE", inWindow);
    await makeEvent("PLAN_ADD", inWindow);
    await makeEvent("CTA_CLICK", inWindow);
    await makeEvent("CTA_CLICK", inWindow);
    await makeEvent("CTA_CLICK", inWindow);
    // Unrelated event type must be excluded.
    await makeEvent("PAGE_VIEW", inWindow);
    // Outside the window must be excluded, even for a counted event type.
    await makeEvent("SAVE", outsideWindow);

    const result = await collectFunnelMetrics({ prisma, now });
    const byMetric = Object.fromEntries(result.map((s) => [s.metric, s.value]));

    assert.equal(byMetric["funnel.content_opens"], 2);
    assert.equal(byMetric["funnel.saves"], 1, "the outside-window SAVE must be excluded");
    assert.equal(byMetric["funnel.plan_adds"], 1);
    assert.equal(byMetric["funnel.cta_clicks"], 3);
    assert.equal(Object.keys(byMetric).length, 4, "exactly the four funnel metrics, PAGE_VIEW must not leak in");

    console.log("funnel.test.ts: OK");
  } finally {
    await prisma.userEvent.deleteMany({ where: { id: { in: createdEventIds } } });
    await prisma.$disconnect();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
