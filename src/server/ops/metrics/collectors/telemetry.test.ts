/**
 * telemetry collector tests (§21 Step 5, Phase P).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/telemetry.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { collectTelemetryEventsWritten } from "./telemetry";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const createdEventIds: string[] = [];

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeEvent(createdAt: Date) {
    const event = await prisma.userEvent.create({
      data: { eventType: "PAGE_VIEW", sessionId: `telemetry-${marker}`, createdAt },
    });
    createdEventIds.push(event.id);
  }

  try {
    const now = new Date("2026-08-17T12:00:00.000Z");

    // Zero is factual with no matching rows.
    {
      const result = await collectTelemetryEventsWritten({ prisma, now });
      assert.equal(result.length, 1);
      assert.equal(result[0].metric, "telemetry.events_written_5m");
      assert.equal(result[0].value, 0);
    }

    // Events in the previous 5m counted; old events excluded.
    await makeEvent(new Date(now.getTime() - 60_000)); // 1 min ago -> counted
    await makeEvent(new Date(now.getTime() - 4 * 60_000)); // 4 min ago -> counted
    await makeEvent(new Date(now.getTime() - 5 * 60_000)); // exactly 5 min ago -> counted (inclusive)
    await makeEvent(new Date(now.getTime() - 6 * 60_000)); // 6 min ago -> excluded

    const result = await collectTelemetryEventsWritten({ prisma, now });
    assert.equal(result[0].value, 3, "must count exactly the events within the trailing 5 minutes");

    console.log("telemetry.test.ts: OK");
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
