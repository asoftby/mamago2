/**
 * B2B queue metric collector tests (§21 Step 5, Phase P).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/b2bQueue.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { collectB2bQueueMetrics } from "./b2bQueue";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const createdRequestIds: string[] = [];
const createdBusinessIds: string[] = [];
const createdUserIds: string[] = [];

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeUser(): Promise<string> {
    const user = await prisma.user.create({ data: { email: `b2b-metric-${marker}-${randomUUID()}@example.invalid` } });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function makeBusiness(): Promise<string> {
    const ownerUserId = await makeUser();
    const business = await prisma.business.create({ data: { name: `b2b-metric-${marker}`, ownerUserId } });
    createdBusinessIds.push(business.id);
    return business.id;
  }

  async function makeRequest(status: "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_INFO"): Promise<void> {
    const businessId = await makeBusiness();
    const requesterUserId = await makeUser();
    const request = await prisma.businessAccessRequest.create({
      data: {
        businessId,
        requesterUserId,
        unp: "100000000",
        name: `b2b-metric-${marker}`,
        requesterRole: "OWNER",
        status,
      },
    });
    createdRequestIds.push(request.id);
  }

  async function cleanup() {
    await prisma.businessAccessRequest.deleteMany({ where: { id: { in: createdRequestIds } } });
    await prisma.business.deleteMany({ where: { id: { in: createdBusinessIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  try {
    const before = await collectB2bQueueMetrics({ prisma, now: new Date() });
    const beforePending = before.find((s) => s.metric === "queue.b2b.pending_size")!.value;

    await makeRequest("PENDING");
    await makeRequest("APPROVED");
    await makeRequest("REJECTED");
    await makeRequest("NEEDS_INFO");

    const after = await collectB2bQueueMetrics({ prisma, now: new Date() });
    const afterPending = after.find((s) => s.metric === "queue.b2b.pending_size")!.value;

    assert.equal(afterPending, beforePending + 1, "only PENDING requests must count toward the queue");
    assert.equal(after.length, 1, "must emit exactly one sample");
    assert.equal(after[0].metric, "queue.b2b.pending_size");

    console.log("b2bQueue.test.ts: OK");
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
