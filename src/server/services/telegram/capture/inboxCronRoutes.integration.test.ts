/**
 * Auth + wiring tests for /api/cron/inbox-recover and /api/cron/inbox-purge
 * against a scratch Postgres. Needs the react-server condition (server-only):
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test, { after, before } from "node:test";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

const SECRET = "test-cron-secret-not-real";
const env = process.env as Record<string, string | undefined>;
delete env.OPENROUTER_CAPTURE_MODEL;
delete env.OPENROUTER_CAPTURE_MODEL_STRONG;

const db = new PrismaClient();
const run = randomUUID().slice(0, 8);
const userId = `cron-${run}`;

function request(path: string, token?: string | null): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: token === undefined || token === null ? {} : { authorization: token },
  });
}

async function routes() {
  const [recover, purge] = await Promise.all([
    import("../../../../app/api/cron/inbox-recover/route"),
    import("../../../../app/api/cron/inbox-purge/route"),
  ]);
  return { recover: recover.GET, purge: purge.GET };
}

async function seed(over: { status: "RECEIVED" | "FAILED"; debounceUntil?: Date; purgeAfter: Date; text: string }) {
  return db.inboxItem.create({
    data: {
      userId,
      environment: "DEV",
      telegramChatId: BigInt(1),
      sourceKind: "TEXT",
      anchorAt: new Date(),
      anchorIsForward: false,
      debounceUntil: over.debounceUntil ?? new Date(),
      status: over.status,
      purgeAfter: over.purgeAfter,
      draft: { marker: over.text },
      parts: {
        create: {
          environment: "DEV",
          telegramUpdateId: BigInt(Date.now()) * BigInt(1000) + BigInt(Math.floor(Math.random() * 999)),
          telegramMessageId: Math.floor(Math.random() * 1_000_000),
          kind: "TEXT",
          text: over.text,
          position: 0,
        },
      },
    },
  });
}

before(async () => {
  await db.user.create({ data: { id: userId, email: `${userId}@example.test` } });
});

after(async () => {
  await db.inboxItem.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});

test("both routes reject a missing or wrong Bearer token with 401 when CRON_SECRET is set", async () => {
  env.CRON_SECRET = SECRET;
  const { recover, purge } = await routes();
  for (const handler of [recover, purge]) {
    assert.equal((await handler(request("/x"))).status, 401);
    assert.equal((await handler(request("/x", "Bearer wrong"))).status, 401);
    assert.equal((await handler(request("/x", SECRET))).status, 401, "the Bearer prefix is required");
  }
});

test("in production both routes answer 503 without CRON_SECRET and never run", async () => {
  delete env.CRON_SECRET;
  const original = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    const { recover, purge } = await routes();
    assert.equal((await recover(request("/x"))).status, 503);
    assert.equal((await purge(request("/x"))).status, 503);
  } finally {
    env.NODE_ENV = original;
  }
});

test("purge route with the right token scrubs expired items and returns counts only", async () => {
  env.CRON_SECRET = SECRET;
  const item = await seed({ status: "FAILED", purgeAfter: new Date(Date.now() - 1000), text: "CRON_SECRET_TEXT_PURGE" });
  const { purge } = await routes();
  const lines: string[] = [];
  const originals = { log: console.log, error: console.error, info: console.info };
  console.log = console.error = console.info = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  let response: Response;
  try {
    response = await purge(request("/x", `Bearer ${SECRET}`));
  } finally {
    Object.assign(console, originals);
  }
  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.success, true);
  assert.ok(typeof body.itemsScrubbed === "number" && (body.itemsScrubbed as number) >= 1);
  assert.ok(!JSON.stringify(body).includes("CRON_SECRET_TEXT_PURGE"));
  assert.ok(lines.every((line) => !line.includes("CRON_SECRET_TEXT_PURGE")));
  const saved = await db.inboxItem.findUniqueOrThrow({ where: { id: item.id }, include: { parts: true } });
  assert.equal(saved.draft, null);
  assert.equal(saved.parts[0]!.text, null);
});

test("recover route runs the real processor for a stuck item; without a capture model it fails with a machine code", async () => {
  env.CRON_SECRET = SECRET;
  const stuck = await seed({ status: "RECEIVED", debounceUntil: new Date(Date.now() - 5 * 60_000), purgeAfter: new Date(Date.now() + 86_400_000), text: "CRON_SECRET_TEXT_RECOVER" });
  const { recover } = await routes();
  const lines: string[] = [];
  const originals = { log: console.log, error: console.error, info: console.info };
  console.log = console.error = console.info = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  let response: Response;
  try {
    response = await recover(request("/x", `Bearer ${SECRET}`));
  } finally {
    Object.assign(console, originals);
  }
  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.ok((body.recovered as number) >= 1);
  const saved = await db.inboxItem.findUniqueOrThrow({ where: { id: stuck.id } });
  assert.equal(saved.status, "FAILED");
  assert.equal(saved.error, "CAPTURE_MODEL_NOT_CONFIGURED");
  assert.ok(lines.every((line) => !line.includes("CRON_SECRET_TEXT_RECOVER")));
});

test("the production runner calls both new routes after the existing jobs", () => {
  const script = readFileSync(new URL("../../../../../scripts/deploy/run-prod-notification-jobs.sh", import.meta.url), "utf8");
  const order = ["/api/cron/plan-event-reminders", "/api/cron/plan-tomorrow-digests", "/api/cron/inbox-recover", "/api/cron/inbox-purge"].map((route) => script.indexOf(`run_job "${route}"`));
  assert.ok(order.every((index) => index >= 0), "all four jobs are called");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "inbox jobs run last");
});
