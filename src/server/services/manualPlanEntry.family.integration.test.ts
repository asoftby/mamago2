import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  cancelManualPlanEntry,
  createManualPlanEntry,
  listFamilyCalendarItems,
  ManualPlanEntryError,
  updateManualPlanEntry,
} from "./manualPlanEntry.service";
import { resolvePlanOwner } from "./planOwner";
import { makePlanItemPrivate, PlanVisibilityError } from "@/server/family/planVisibility.service";

const url = process.env.DATABASE_URL;
if (!url || !url.includes("isolated")) throw new Error("Use an isolated test DATABASE_URL");
process.env.FAMILY_CORE_READS = "1";
const db = new PrismaClient({ datasourceUrl: url });
const marker = randomUUID();

async function expectManualCode(work: Promise<unknown>, code: ManualPlanEntryError["code"]) {
  await assert.rejects(work, (error) => error instanceof ManualPlanEntryError && error.code === code);
}

async function run() {
  const [a, b, outsider] = await Promise.all(["a", "b", "outsider"].map((name) =>
    db.user.create({ data: { email: `calendar-family-${name}-${marker}@example.invalid` } }),
  ));
  const family = await db.family.create({ data: {} });
  const foreignFamily = await db.family.create({ data: {} });
  await db.familyMembership.createMany({ data: [
    { userId: a.id, familyId: family.id, role: "OWNER" },
    { userId: b.id, familyId: family.id, role: "ADULT" },
    { userId: outsider.id, familyId: foreignFamily.id, role: "OWNER" },
  ] });
  const child = await db.child.create({ data: { parentId: a.id, familyId: family.id, name: "Family child" } });
  const foreignChild = await db.child.create({ data: { parentId: outsider.id, familyId: foreignFamily.id, name: "Foreign child" } });
  const [ownerA, ownerB, ownerOutsider] = await Promise.all([a.id, b.id, outsider.id].map((id) => resolvePlanOwner(id)));
  try {
    const shared = await createManualPlanEntry(ownerA, {
      entryType: "EVENT", title: "Shared", date: "2026-10-15", childId: child.id, startsAt: "09:00", endsAt: "10:00",
    });
    assert.equal(shared.familyId, family.id);
    assert.equal(shared.visibility, "FAMILY");
    const bView = await listFamilyCalendarItems({ owner: ownerB, from: "2026-10-15", to: "2026-10-15" });
    assert.ok(bView.some((item) => item.id === shared.id && item.authorId === a.id));
    assert.equal((await listFamilyCalendarItems({ owner: ownerOutsider, from: "2026-10-15", to: "2026-10-15" }))
      .some((item) => item.id === shared.id), false);

    const edited = await updateManualPlanEntry(ownerB, shared.id, { title: "Edited by B" }, shared.updatedAt.toISOString());
    assert.equal(edited.title, "Edited by B");
    await expectManualCode(updateManualPlanEntry(ownerA, shared.id, { title: "Stale A" }, shared.updatedAt.toISOString()), "CONFLICT");
    assert.equal((await db.planItem.findUniqueOrThrow({ where: { id: shared.id } })).title, "Edited by B");

    const moved = await updateManualPlanEntry(ownerB, shared.id,
      { date: "2026-10-16", startsAt: "11:00", endsAt: "12:00" }, edited.updatedAt.toISOString());
    assert.equal(moved.date, "2026-10-16");
    assert.equal(moved.startsAt?.toISOString(), "2026-10-16T08:00:00.000Z");
    assert.equal(await db.userEvent.count({ where: {
      userId: b.id, eventType: "PLAN_ITEM_RESCHEDULED", meta: { path: ["planItemId"], equals: shared.id },
    } }), 1);

    await assert.rejects(makePlanItemPrivate({ userId: b.id, planItemId: shared.id, expectedUpdatedAt: moved.updatedAt }),
      (error) => error instanceof PlanVisibilityError && error.code === "not_author");
    await expectManualCode(updateManualPlanEntry(ownerOutsider, shared.id, { title: "Foreign" }, moved.updatedAt.toISOString()), "NOT_FOUND");
    await expectManualCode(cancelManualPlanEntry(ownerOutsider, shared.id, moved.updatedAt.toISOString()), "NOT_FOUND");
    await expectManualCode(updateManualPlanEntry(ownerB, shared.id, { childId: foreignChild.id }, moved.updatedAt.toISOString()), "NOT_FOUND");

    const privateItem = await db.planItem.update({ where: { id: shared.id }, data: { visibility: "PRIVATE" } });
    assert.equal((await listFamilyCalendarItems({ owner: ownerB, from: "2026-10-16", to: "2026-10-16" }))
      .some((item) => item.id === shared.id), false);
    await expectManualCode(updateManualPlanEntry(ownerB, shared.id, { title: "Private B" }, privateItem.updatedAt.toISOString()), "NOT_FOUND");
    await expectManualCode(cancelManualPlanEntry(ownerB, shared.id, privateItem.updatedAt.toISOString()), "NOT_FOUND");

    const proposed = await createManualPlanEntry(ownerA, { entryType: "TASK", title: "Proposal", date: "2026-10-18" });
    const proposedRow = await db.planItem.update({ where: { id: proposed.id }, data: { status: "PROPOSED" } });
    assert.equal((await listFamilyCalendarItems({ owner: ownerB, from: "2026-10-18", to: "2026-10-18" }))
      .find((item) => item.id === proposed.id)?.status, "PROPOSED");
    await expectManualCode(updateManualPlanEntry(ownerB, proposed.id, { title: "No premature edit" }, proposedRow.updatedAt.toISOString()), "NOT_FOUND");
    await expectManualCode(cancelManualPlanEntry(ownerB, proposed.id, proposedRow.updatedAt.toISOString()), "NOT_FOUND");

    const sharedAgain = await createManualPlanEntry(ownerA, { entryType: "TASK", title: "Concurrent", date: "2026-10-17" });
    const version = sharedAgain.updatedAt.toISOString();
    const outcomes = await Promise.allSettled([
      updateManualPlanEntry(ownerA, sharedAgain.id, { title: "A wins" }, version),
      updateManualPlanEntry(ownerB, sharedAgain.id, { title: "B wins" }, version),
    ]);
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    assert.equal(outcomes.filter((outcome) => outcome.status === "rejected" &&
      outcome.reason instanceof ManualPlanEntryError && outcome.reason.code === "CONFLICT").length, 1);
    const winner = await db.planItem.findUniqueOrThrow({ where: { id: sharedAgain.id } });
    assert.ok(winner.title === "A wins" || winner.title === "B wins");
    await expectManualCode(cancelManualPlanEntry(ownerB, sharedAgain.id, version), "CONFLICT");
    await cancelManualPlanEntry(ownerB, sharedAgain.id, winner.updatedAt.toISOString());
    assert.equal((await db.planItem.findUniqueOrThrow({ where: { id: sharedAgain.id } })).status, "CANCELLED");

    const afterLeave = await createManualPlanEntry(ownerA, { entryType: "TASK", title: "After leave", date: "2026-10-19" });
    await db.familyMembership.updateMany({ where: { familyId: family.id, userId: b.id, leftAt: null }, data: { leftAt: new Date() } });
    assert.equal((await listFamilyCalendarItems({ owner: ownerB, from: "2026-10-19", to: "2026-10-19" }))
      .some((item) => item.id === afterLeave.id), false);
    await expectManualCode(updateManualPlanEntry(ownerB, afterLeave.id, { title: "Inactive" }, afterLeave.updatedAt.toISOString()), "NOT_FOUND");
    await expectManualCode(cancelManualPlanEntry(ownerB, afterLeave.id, afterLeave.updatedAt.toISOString()), "NOT_FOUND");
  } finally {
    await db.userEvent.deleteMany({ where: { userId: { in: [a.id, b.id, outsider.id] } } });
    await db.planItem.deleteMany({ where: { userId: { in: [a.id, b.id, outsider.id] } } });
    await db.child.deleteMany({ where: { id: { in: [child.id, foreignChild.id] } } });
    await db.familyMembership.deleteMany({ where: { familyId: { in: [family.id, foreignFamily.id] } } });
    await db.family.deleteMany({ where: { id: { in: [family.id, foreignFamily.id] } } });
    await db.user.deleteMany({ where: { id: { in: [a.id, b.id, outsider.id] } } });
    await db.$disconnect();
  }
}

run().then(() => console.log("shared manual family integration: OK")).catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exitCode = 1;
});
