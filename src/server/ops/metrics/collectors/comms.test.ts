/**
 * comms metric collector tests (§21 Step 5, Phase P).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/comms.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { collectCommsMetrics } from "./comms";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const createdDeliveryIds: string[] = [];
const createdUserIds: string[] = [];

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeUser(): Promise<string> {
    const user = await prisma.user.create({ data: { email: `comms-metric-${marker}-${randomUUID()}@example.invalid` } });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function makeDelivery(status: "PENDING" | "SENT" | "FAILED" | "SKIPPED", createdAt: Date): Promise<void> {
    const userId = await makeUser();
    const delivery = await prisma.notificationDelivery.create({
      data: { userId, channel: "EMAIL", status, createdAt },
    });
    createdDeliveryIds.push(delivery.id);
  }

  async function cleanup() {
    await prisma.notificationDelivery.deleteMany({ where: { id: { in: createdDeliveryIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  try {
    const now = new Date();
    const before = await collectCommsMetrics({ prisma, now });
    const beforeFailed = before.find((s) => s.metric === "comms.failed_deliveries_1h")!.value;

    // FAILED within the last hour -> counted.
    await makeDelivery("FAILED", new Date(now.getTime() - 10 * 60_000));
    // FAILED older than 1h -> excluded.
    await makeDelivery("FAILED", new Date(now.getTime() - 2 * 60 * 60_000));
    // SENT -> excluded regardless of window.
    await makeDelivery("SENT", new Date(now.getTime() - 5 * 60_000));

    const after = await collectCommsMetrics({ prisma, now });
    const afterFailed = after.find((s) => s.metric === "comms.failed_deliveries_1h")!.value;

    assert.equal(afterFailed, beforeFailed + 1, "only FAILED deliveries within the trailing hour must count");
    assert.equal(after.length, 1);
    assert.equal(after[0].metric, "comms.failed_deliveries_1h");

    console.log("comms.test.ts: OK");
  } finally {
    await cleanup();
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
