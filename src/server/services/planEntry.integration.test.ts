import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { Prisma, PrismaClient } from "@prisma/client";
import { draft, entry } from "./telegram/capture/captureDraft.testkit";
import {
  createFromDraft,
  PlanEntryError,
} from "./planEntry.service";

const db = new PrismaClient();
const run = randomUUID().slice(0, 8);
const userId = `pr4-${run}-user`;
const childId = `pr4-${run}-child`;
const inboxIds: string[] = [];

async function seedInbox(over: {
  id: string;
  duplicate?: boolean;
}) {
  const value = draft({
    entries: [
      entry({
        child: {
          childId,
          raw: "Тая",
          state: "stated",
        },
        location: {
          value: "Музей",
          placeId: null,
          state: "stated",
        },
        requirements: [
          {
            kind: "PAY",
            text: "передать 15 BYN",
            dueAt: "2026-10-07T00:00:00+03:00",
            dueHasTime: false,
            amount: 15,
            currency: "BYN",
            state: "stated",
          },
          {
            kind: "BRING",
            text: "взять воду",
            dueAt: null,
            dueHasTime: false,
            amount: null,
            currency: null,
            state: "stated",
          },
        ],
      }),
    ],
  });

  inboxIds.push(over.id);
  await db.inboxItem.create({
    data: {
      id: over.id,
      userId,
      environment: "DEV",
      telegramChatId: BigInt(987654321),
      sourceKind: "TEXT",
      anchorAt: new Date("2026-10-06T12:00:00.000Z"),
      anchorIsForward: false,
      debounceUntil: new Date("2026-10-06T12:00:00.000Z"),
      status: "DRAFT_READY",
      intent: "CREATE",
      draft: value as unknown as Prisma.InputJsonValue,
      draftVersion: 1,
      ruleCodes: over.duplicate ? ["DUPLICATE_FOUND"] : [],
      purgeAfter: new Date("2026-10-13T12:00:00.000Z"),
      parts: {
        create: {
          environment: "DEV",
          telegramUpdateId: BigInt(
            800000000 + Math.floor(Math.random() * 100000000),
          ),
          telegramMessageId: 1,
          kind: "TEXT",
          text: "private marker",
          position: 0,
        },
      },
    },
  });
}

after(async () => {
  await db.planItem.deleteMany({ where: { inboxItemId: { in: inboxIds } } });
  await db.inboxItem.deleteMany({ where: { id: { in: inboxIds } } });
  await db.child.deleteMany({ where: { id: childId } });

  const memberships = await db.familyMembership.findMany({
    where: { userId },
    select: { familyId: true },
  });
  await db.user.deleteMany({ where: { id: userId } });
  if (memberships.length) {
    await db.family.deleteMany({
      where: { id: { in: memberships.map((row) => row.familyId) } },
    });
  }
  await db.$disconnect();
});

test("createFromDraft is idempotent and clears raw inbox data", async () => {
  await db.user.create({
    data: { id: userId, email: `${userId}@example.test` },
  });
  await db.child.create({
    data: { id: childId, parentId: userId, name: "Тая" },
  });

  const inboxId = `pr4-${run}-normal`;
  await seedInbox({ id: inboxId });

  const first = await createFromDraft({ userId }, inboxId);
  const second = await createFromDraft({ userId }, inboxId);

  assert.equal(first.status, "created");
  assert.equal(first.planItemIds.length, 1);
  assert.equal(second.status, "already_handled");

  const rows = await db.planItem.findMany({
    where: { inboxItemId: inboxId },
    include: { requirements: true },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.source, "TELEGRAM_FORWARD");
  assert.equal(rows[0]!.entryType, "EVENT");
  assert.equal(rows[0]!.date, "2026-10-09");
  assert.equal(rows[0]!.childId, childId);
  assert.equal(rows[0]!.requirements.length, 2);

  const inbox = await db.inboxItem.findUniqueOrThrow({
    where: { id: inboxId },
    include: { parts: true },
  });
  assert.equal(inbox.status, "CONFIRMED");
  assert.equal(inbox.draft, null);
  assert.ok(inbox.parts.every((part) => part.text === null));
});

test("duplicate draft needs explicit add-anyway confirmation", async () => {
  const inboxId = `pr4-${run}-dup`;
  await seedInbox({ id: inboxId, duplicate: true });

  await assert.rejects(
    () => createFromDraft({ userId }, inboxId),
    (error: unknown) =>
      error instanceof PlanEntryError &&
      error.code === "DUPLICATE_REQUIRES_CONFIRMATION",
  );

  const untouched = await db.inboxItem.findUniqueOrThrow({
    where: { id: inboxId },
    select: { status: true },
  });
  assert.equal(untouched.status, "DRAFT_READY");

  const confirmed = await createFromDraft(
    { userId },
    inboxId,
    { allowDuplicate: true },
  );
  assert.equal(confirmed.status, "created");
  assert.equal(
    await db.planItem.count({ where: { inboxItemId: inboxId } }),
    1,
  );
});
