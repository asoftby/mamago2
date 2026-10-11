import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  createManualPlanEntry,
  ManualPlanEntryError,
  updateManualPlanEntry,
  updateTelegramPlanEntry,
} from "../manualPlanEntry.service";
import { resolvePlanOwner } from "../planOwner";

// Guard against an accidental production or ordinary local-database run.
if (!process.env.DATABASE_URL?.includes("mamago_telegram_move_isolated")) {
  throw new Error("Run against the dedicated isolated Telegram move test database");
}
process.env.FAMILY_CORE_READS = "1";
const db = new PrismaClient();
const marker = randomUUID();

async function expectCode(work: Promise<unknown>, code: ManualPlanEntryError["code"]) {
  await assert.rejects(work, (error: unknown) =>
    error instanceof ManualPlanEntryError && error.code === code);
}

async function run() {
  const user = await db.user.create({ data: { email: `telegram-move-${marker}@example.invalid` } });
  const outsider = await db.user.create({ data: { email: `telegram-move-other-${marker}@example.invalid` } });
  const family = await db.family.create({ data: {} });
  await db.familyMembership.create({
    data: { familyId: family.id, userId: user.id, role: "OWNER" },
  });
  const owner = await resolvePlanOwner(user.id);
  const outsiderOwner = await resolvePlanOwner(outsider.id);
  const inboxId = `test-telegram-original-${marker}`;
  try {
    const original = await db.planItem.create({
      data: {
        userId: user.id,
        familyId: family.id,
        title: "Материк",
        source: "TELEGRAM_FORWARD",
        entryType: "EVENT",
        date: "2026-10-13",
        startsAt: new Date("2026-10-13T07:00:00Z"),
        endsAt: new Date("2026-10-13T08:00:00Z"),
        inboxItemId: inboxId,
        locationText: "Материк",
        reminderEnabled: false,
      },
    });
    const manual = await createManualPlanEntry(owner, { title: "Отдельное дело", date: "2026-10-13" });

    // Time and date are changed in-place, not duplicated, even if the message
    // is originally extracted as EVENT instead of a manual TASK.
    const moved = await updateTelegramPlanEntry(owner, original.id, {
      date: "2026-10-14",
      startsAt: "16:30",
      endsAt: null,
      reminderEnabled: true,
      reminderLeadMinutes: 60,
    }, original.updatedAt.toISOString());
    assert.equal(moved.source, "TELEGRAM_FORWARD");
    const persisted = await db.planItem.findUniqueOrThrow({ where: { id: original.id } });
    assert.equal(persisted.inboxItemId, inboxId);
    assert.equal(moved.entryType, "EVENT");
    assert.equal(moved.title, "Материк");
    assert.equal(moved.locationText, "Материк");
    assert.equal(moved.date, "2026-10-14");
    assert.equal(moved.startsAt?.toISOString(), "2026-10-14T13:30:00.000Z");
    assert.equal(moved.endsAt, null);
    assert.equal(moved.reminderEnabled, true);
    assert.equal(moved.reminderLeadMinutes, 60);
    assert.equal(await db.planItem.count({ where: { inboxItemId: inboxId } }), 1);

    await expectCode(
      updateTelegramPlanEntry(owner, original.id, { startsAt: "18:00" }, original.updatedAt.toISOString()),
      "CONFLICT",
    );
    await expectCode(
      updateManualPlanEntry(owner, original.id, { startsAt: "18:00" }, moved.updatedAt.toISOString()),
      "NOT_FOUND",
    );
    await expectCode(
      updateTelegramPlanEntry(owner, manual.id, { startsAt: "18:00" }, manual.updatedAt.toISOString()),
      "NOT_FOUND",
    );
    await expectCode(
      updateTelegramPlanEntry(outsiderOwner, original.id, { startsAt: "18:00" }, moved.updatedAt.toISOString()),
      "NOT_FOUND",
    );
    await expectCode(
      updateTelegramPlanEntry(owner, original.id, { startsAt: "27:00" }, moved.updatedAt.toISOString()),
      "INVALID_INPUT",
    );

    const untimed = await updateTelegramPlanEntry(owner, original.id, {
      startsAt: null, reminderEnabled: false, reminderLeadMinutes: null,
    }, moved.updatedAt.toISOString());
    assert.equal(untimed.startsAt, null);
    assert.equal(untimed.reminderEnabled, false);
    assert.equal(untimed.reminderLeadMinutes, null);
    console.log("Telegram plan move integration: PASS");
  } finally {
    await db.userEvent.deleteMany({ where: { userId: { in: [user.id, outsider.id] } } });
    await db.planItem.deleteMany({ where: { userId: { in: [user.id, outsider.id] } } });
    await db.familyMembership.deleteMany({ where: { familyId: family.id } });
    await db.family.delete({ where: { id: family.id } });
    await db.user.deleteMany({ where: { id: { in: [user.id, outsider.id] } } });
    await db.$disconnect();
  }
}

run().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exitCode = 1;
});
