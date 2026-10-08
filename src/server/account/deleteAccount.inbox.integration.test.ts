/**
 * Account deletion must remove forwarded-message data. The User row survives
 * as a tombstone, so FK cascades from User never fire: InboxItem has to be
 * deleted explicitly (InboxItemPart and PlanItemRequirement then cascade).
 *
 * Run against a scratch DB with the react-server condition (server-only):
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { deleteAccount } from "./deleteAccount.service";

const db = new PrismaClient();
const userId = `delinbox-${randomUUID().slice(0, 8)}`;

after(async () => {
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});

test("deleteAccount removes inbox items, their parts and plan requirements", async () => {
  await db.user.create({ data: { id: userId, email: `${userId}@example.test` } });
  const item = await db.inboxItem.create({
    data: {
      userId,
      environment: "DEV",
      telegramChatId: BigInt(1),
      sourceKind: "TEXT",
      anchorAt: new Date(),
      anchorIsForward: false,
      debounceUntil: new Date(),
      purgeAfter: new Date(Date.now() + 86_400_000),
      draft: { marker: "DELETE_ME" },
      parts: {
        create: {
          environment: "DEV",
          telegramUpdateId: BigInt(Date.now()),
          telegramMessageId: 1,
          kind: "TEXT",
          text: "DELETE_ME",
          position: 0,
        },
      },
    },
  });
  const plan = await db.planItem.create({
    data: {
      userId,
      date: "2026-10-10",
      title: "bot entry",
      source: "TELEGRAM_FORWARD",
      requirements: { create: { kind: "BRING", text: "вода" } },
    },
  });

  assert.deepEqual(await deleteAccount(userId, db), { ok: true });

  assert.equal(await db.inboxItem.count({ where: { userId } }), 0);
  assert.equal(await db.inboxItemPart.count({ where: { inboxItemId: item.id } }), 0);
  assert.equal(await db.planItem.count({ where: { userId } }), 0);
  assert.equal(await db.planItemRequirement.count({ where: { planItemId: plan.id } }), 0);
  const tombstone = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assert.ok(tombstone.deletedAt, "the User row is kept as a tombstone");
});
