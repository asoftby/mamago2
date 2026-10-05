import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PlanEntryType, PlanItemSource, PrismaClient } from "@prisma/client";
import {
  cancelManualPlanEntry,
  createManualPlanEntry,
  listFamilyCalendarItems,
  ManualPlanEntryError,
  toFamilyCalendarItemDto,
  updateManualPlanEntry,
  validateFamilyCalendarRange,
} from "./manualPlanEntry.service";
import { resolvePlanOwner } from "./planOwner";
import { listPendingExperienceCandidates } from "./experience/experience.service";
import { computeLegacyPlanFingerprint, computePlanFingerprint, listPlanItemsByDateForScenario } from "./dayScenario.service";
import { loadFamilyCalendarItem, loadFamilyCalendarRange } from "./familyCalendar.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at an isolated test database");
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const marker = randomUUID();

async function expectCode(promise: Promise<unknown>, code: ManualPlanEntryError["code"]) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ManualPlanEntryError);
    assert.equal(error.code, code);
    return true;
  });
}

async function main() {
  const owner = await prisma.user.create({ data: { email: `calendar-owner-${marker}@example.invalid` } });
  const stranger = await prisma.user.create({ data: { email: `calendar-stranger-${marker}@example.invalid` } });
  const child = await prisma.child.create({ data: { parentId: owner.id, name: "Аня" } });
  const foreignChild = await prisma.child.create({ data: { parentId: stranger.id, name: "Чужой ребёнок" } });
  const ownerScope = resolvePlanOwner(owner.id);
  const strangerScope = resolvePlanOwner(stranger.id);

  try {
    const created: Awaited<ReturnType<typeof createManualPlanEntry>>[] = [];
    for (const entryType of [PlanEntryType.EVENT, PlanEntryType.ACTIVITY, PlanEntryType.TASK]) {
      created.push(await createManualPlanEntry(ownerScope, {
        entryType,
        title: ` ${entryType} `,
        childId: child.id,
        date: "2026-10-01",
        startsAt: entryType === PlanEntryType.EVENT ? "09:30" : null,
        endsAt: entryType === PlanEntryType.EVENT ? "10:45" : null,
        locationText: " Дом культуры ",
        notes: " Частная заметка ",
      }));
    }
    assert.deepEqual(created.map((item) => item.entryType), ["EVENT", "ACTIVITY", "TASK"]);
    assert.ok(created.every((item) => item.source === PlanItemSource.MANUAL));
    assert.ok(created.every((item) => !("userId" in item)), "mutation result must not expose owner ids");
    assert.equal(created[0]!.startsAt?.toISOString(), "2026-10-01T06:30:00.000Z");
    assert.equal((await createManualPlanEntry(ownerScope, {
      entryType: PlanEntryType.TASK,
      title: "Без участника",
      date: "2026-09-30",
    })).childId, null);

    await expectCode(createManualPlanEntry(ownerScope, {
      entryType: PlanEntryType.EVENT,
      title: "Чужая привязка",
      childId: foreignChild.id,
      date: "2026-10-01",
    }), "NOT_FOUND");
    await expectCode(createManualPlanEntry(ownerScope, {
      entryType: PlanEntryType.EVENT,
      title: "<script>",
      date: "2026-10-01",
    }), "INVALID_INPUT");
    await expectCode(createManualPlanEntry(ownerScope, {
      entryType: PlanEntryType.EVENT,
      title: "Неверная дата",
      date: "2026-02-30",
    }), "INVALID_INPUT");
    await expectCode(createManualPlanEntry(ownerScope, {
      entryType: PlanEntryType.EVENT,
      title: "Неверный интервал",
      date: "2026-10-01",
      startsAt: "12:00",
      endsAt: "11:00",
    }), "INVALID_INPUT");

    const moved = await updateManualPlanEntry(ownerScope, created[0]!.id, { date: "2026-09-29" });
    assert.equal(moved.startsAt?.toISOString(), "2026-09-29T06:30:00.000Z");
    assert.equal(moved.endsAt?.toISOString(), "2026-09-29T07:45:00.000Z");
    assert.equal(moved.title, "EVENT");
    assert.equal(moved.childId, child.id);
    assert.equal(moved.locationText, "Дом культуры");
    assert.equal(moved.notes, "Частная заметка");
    const cleared = await updateManualPlanEntry(ownerScope, moved.id, {
      childId: null,
      startsAt: null,
      endsAt: null,
      locationText: null,
      notes: null,
      dueAt: null,
    });
    assert.equal(cleared.childId, null);
    assert.equal(cleared.startsAt, null);
    assert.equal(cleared.locationText, null);
    assert.equal(cleared.notes, null);
    assert.equal(cleared.dueHasTime, false);
    await expectCode(updateManualPlanEntry(strangerScope, moved.id, { title: "Захват" }), "NOT_FOUND");

    const catalog = await prisma.planItem.create({
      data: { userId: owner.id, source: PlanItemSource.CATALOG, date: "2026-10-02", title: "Каталог" },
    });
    await expectCode(updateManualPlanEntry(ownerScope, catalog.id, { title: "Подмена" }), "NOT_FOUND");
    await expectCode(cancelManualPlanEntry(ownerScope, catalog.id), "NOT_FOUND");
    const telegram = await prisma.planItem.create({
      data: { userId: owner.id, source: PlanItemSource.TELEGRAM_FORWARD, date: "2026-10-02", title: "Telegram" },
    });
    await expectCode(updateManualPlanEntry(ownerScope, telegram.id, { title: "Подмена" }), "NOT_FOUND");
    const foreignItem = await createManualPlanEntry(strangerScope, {
      entryType: PlanEntryType.EVENT,
      title: "Чужая запись",
      date: "2026-10-02",
    });

    const timed = await createManualPlanEntry(ownerScope, {
      entryType: PlanEntryType.TASK,
      title: "Первое по времени",
      date: "2026-10-02",
      startsAt: "08:00",
    });
    const listed = await listFamilyCalendarItems({ owner: ownerScope, from: "2026-09-28", to: "2026-10-04" });
    assert.ok(listed.some((item) => item.id === moved.id));
    assert.equal(listed.some((item) => item.id === foreignItem.id), false);
    assert.deepEqual(
      [...new Set(listed.filter((item) => item.date === "2026-10-02").map((item) => item.source))].sort(),
      [PlanItemSource.CATALOG, PlanItemSource.MANUAL, PlanItemSource.TELEGRAM_FORWARD].sort(),
    );
    const octoberSecond = listed.filter((item) => item.date === "2026-10-02");
    assert.equal(octoberSecond[0]?.id, timed.id, "timed items sort before untimed items");
    const safe = listed.find((item) => item.id === created[1]!.id)!;
    assert.equal(safe.childName, "Аня");
    assert.equal("userId" in safe, false);
    assert.equal("inboxItemId" in safe, false);
    assert.equal("decisionId" in safe, false);

    const dto = toFamilyCalendarItemDto(created[1]!);
    assert.equal(dto.source, PlanItemSource.MANUAL);
    assert.equal(dto.activity, null);
    assert.equal(dto.planAvailability, "missing_activity");

    const scenarioItems = await listPlanItemsByDateForScenario(owner.id, "2026-10-01");
    assert.ok(scenarioItems.some((item) => item.id === created[2]!.id && item.startsAt == null && item.activity == null));
    assert.ok(scenarioItems.some((item) => item.id === created[0]!.id) === false, "moved item left the original day");
    const timedScenarioItems = await listPlanItemsByDateForScenario(owner.id, "2026-10-02");
    assert.ok(timedScenarioItems.some((item) => item.id === timed.id && item.startsAt != null && item.activity == null));

    const legacyDate = "2026-10-01";
    const legacyRows = await prisma.planItem.findMany({
      where: { userId: owner.id, date: legacyDate, cancelledAt: null },
      select: {
        id: true, activityId: true, routeId: true, placeId: true, articleId: true,
        date: true, startsAt: true, endsAt: true, childId: true,
      },
    });
    const overrideTime = new Date("2026-10-01T11:00:00.000Z"); // 14:00 Minsk
    const legacyScenario = await prisma.dayScenario.create({
      data: { userId: owner.id, date: legacyDate, planFingerprint: "pending" },
    });
    await prisma.dayScenarioItemOverride.create({
      data: { scenarioId: legacyScenario.id, planItemId: created[2]!.id, startTimeOverride: overrideTime },
    });
    await prisma.dayScenario.update({
      where: { id: legacyScenario.id },
      data: { planFingerprint: computeLegacyPlanFingerprint(legacyRows, new Map([[created[2]!.id, overrideTime]])) },
    });
    const legacyReady = await loadFamilyCalendarRange({ owner: ownerScope, from: legacyDate, to: legacyDate });
    assert.equal(legacyReady.scenarioStatusByDate[legacyDate], "ready");
    const renamedUntimed = await updateManualPlanEntry(ownerScope, created[2]!.id, { title: "Новое название" });
    const mutationDto = await loadFamilyCalendarItem({ owner: ownerScope, item: renamedUntimed });
    assert.equal(mutationDto.startsAt, null);
    assert.equal(mutationDto.effectiveStartsAt, overrideTime.toISOString());
    assert.equal((await loadFamilyCalendarRange({ owner: ownerScope, from: legacyDate, to: legacyDate })).scenarioStatusByDate[legacyDate], "ready");

    assert.equal(await prisma.experience.count({ where: { userId: owner.id } }), 0);
    assert.equal(await prisma.userEvent.count({ where: { userId: owner.id, eventType: "ATTENDED" } }), 0);
    assert.equal(await prisma.userEvent.count({ where: { userId: owner.id } }), 0, "manual writes emit no behavioral events");

    const fingerprintItems = await prisma.planItem.findMany({
      where: { userId: owner.id, date: "2026-10-02", cancelledAt: null },
      select: {
        id: true, activityId: true, routeId: true, placeId: true, articleId: true,
        date: true, startsAt: true, endsAt: true, childId: true,
      },
    });
    await prisma.dayScenario.create({
      data: {
        userId: owner.id,
        date: "2026-10-02",
        planFingerprint: computePlanFingerprint(fingerprintItems),
      },
    });
    const readyRange = await loadFamilyCalendarRange({ owner: ownerScope, from: "2026-09-28", to: "2026-10-04" });
    assert.equal(readyRange.scenarioStatusByDate["2026-10-02"], "ready");
    await updateManualPlanEntry(ownerScope, timed.id, { startsAt: "08:30" });
    const changedRange = await loadFamilyCalendarRange({ owner: ownerScope, from: "2026-09-28", to: "2026-10-04" });
    assert.equal(changedRange.scenarioStatusByDate["2026-10-02"], "changed");
    const currentFingerprintItems = await prisma.planItem.findMany({
      where: { userId: owner.id, date: "2026-10-02", cancelledAt: null },
      select: {
        id: true, activityId: true, routeId: true, placeId: true, articleId: true,
        date: true, startsAt: true, endsAt: true, childId: true,
      },
    });
    await prisma.dayScenario.update({
      where: { userId_date: { userId: owner.id, date: "2026-10-02" } },
      data: { planFingerprint: computePlanFingerprint(currentFingerprintItems) },
    });
    await cancelManualPlanEntry(ownerScope, timed.id);
    const cancelledRange = await loadFamilyCalendarRange({ owner: ownerScope, from: "2026-09-28", to: "2026-10-04" });
    assert.equal(cancelledRange.scenarioStatusByDate["2026-10-02"], "changed");

    await cancelManualPlanEntry(ownerScope, created[1]!.id);
    await cancelManualPlanEntry(ownerScope, created[1]!.id);
    const afterCancel = await listFamilyCalendarItems({ owner: ownerScope, from: "2026-09-28", to: "2026-10-04" });
    assert.equal(afterCancel.some((item) => item.id === created[1]!.id), false);
    await expectCode(updateManualPlanEntry(ownerScope, created[1]!.id, { title: "После отмены" }), "NOT_FOUND");

    assert.deepEqual(validateFamilyCalendarRange("2026-09-01", "2026-10-12"), {
      from: "2026-09-01",
      to: "2026-10-12",
    });
    assert.throws(() => validateFamilyCalendarRange("2026-09-01", "2026-10-13"), ManualPlanEntryError);
    assert.throws(() => validateFamilyCalendarRange("invalid", "2026-10-01"), ManualPlanEntryError);

    const candidates = await listPendingExperienceCandidates({
      userId: owner.id,
      today: "2026-10-03",
      lookbackDays: 7,
      take: 10,
    });
    assert.equal(candidates.some((candidate) => candidate.planItemId === moved.id), false);
  } finally {
    await prisma.dayScenario.deleteMany({ where: { userId: { in: [owner.id, stranger.id] } } });
    await prisma.planItem.deleteMany({ where: { userId: { in: [owner.id, stranger.id] } } });
    await prisma.child.deleteMany({ where: { parentId: { in: [owner.id, stranger.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } });
    await prisma.$disconnect();
  }
}

main().then(() => console.log("manual PlanItem calendar integration tests: OK")).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
