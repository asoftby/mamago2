/**
 * Integration test for BACKLOG-153: updateActivity() (activity.service.ts),
 * reached via PATCH /api/business/activities/[id], must not destroy
 * import-sourced ActivitySession rows — same contract PR #298 already
 * enforces for the main event wizard route
 * (src/app/api/business/events/[id]/route.ts's hasImportedSessions), which
 * never covered this older route.
 *
 * Self-generated fixtures (1 user + 2 activities), cleaned up in a finally
 * block. Exercises the real updateActivity() against the local dev DB.
 *
 * Run: set -a; source .env; set +a; npx tsx src/server/services/activity.service.readonlyImportSessions.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { updateActivity } from "./activity.service";
import { ABWS_PARSER_KEY } from "@/server/modules/import/normalizers/abws-event.normalizer";

async function main() {
  const marker = randomUUID();
  const createdUserIds: string[] = [];
  const createdActivityIds: string[] = [];

  async function createUser() {
    const user = await prisma.user.create({
      data: { email: `activity-service-readonly-${marker}@example.invalid` },
      select: { id: true },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function createActivity(ownerUserId: string, title: string) {
    const activity = await prisma.activity.create({
      data: {
        ownerUserId,
        title,
        shortDesc: "test",
        type: "EVENT",
        scheduleMode: "ONE_TIME",
      },
      select: { id: true },
    });
    createdActivityIds.push(activity.id);
    return activity.id;
  }

  try {
    const ownerUserId = await createUser();

    // ── Ordinary activity (no imported sessions) — updateActivity must keep
    // replacing sessions exactly as before this fix (no regression). ──
    const ordinaryActivityId = await createActivity(ownerUserId, `Ordinary ${marker}`);
    await prisma.activitySession.createMany({
      data: [{ activityId: ordinaryActivityId, startsAt: new Date("2026-10-01T10:00:00Z") }],
    });

    const newOrdinaryDates = [new Date("2026-11-01T12:00:00Z"), new Date("2026-11-02T12:00:00Z")];
    const updatedOrdinary = await updateActivity(ordinaryActivityId, { sessions: newOrdinaryDates });

    assert.equal(
      updatedOrdinary.sessions.length,
      2,
      "an ordinary activity's sessions must still be replaced by a PATCH with a new sessions array",
    );
    assert.deepEqual(
      updatedOrdinary.sessions.map((s) => s.startsAt.toISOString()).sort(),
      newOrdinaryDates.map((d) => d.toISOString()).sort(),
      "the new session dates must be exactly what was sent — unchanged behavior for non-imported activities",
    );

    // ── Activity with an imported session — updateActivity must leave
    // sessions untouched entirely: no deleteMany, no recreate. ──
    const importedActivityId = await createActivity(ownerUserId, `Imported ${marker}`);
    const importedSession = await prisma.activitySession.create({
      data: {
        activityId: importedActivityId,
        startsAt: new Date("2026-10-05T15:00:00Z"),
        source: ABWS_PARSER_KEY,
        externalId: `ext-${marker}`,
        priceMinCents: 4000,
        buyUrl: "https://saleframe.24afisha.by/?sid=123",
      },
    });

    const attemptedNewDates = [new Date("2026-12-01T09:00:00Z")];
    const updatedImported = await updateActivity(importedActivityId, { sessions: attemptedNewDates });

    assert.equal(
      updatedImported.sessions.length,
      1,
      "an imported session must not be deleted or duplicated by this route",
    );
    assert.equal(
      updatedImported.sessions[0]?.id,
      importedSession.id,
      "the exact same ActivitySession row must survive — not a recreated one with a new id",
    );
    assert.equal(
      updatedImported.sessions[0]?.startsAt.toISOString(),
      importedSession.startsAt.toISOString(),
      "the imported session's startsAt must be untouched by the attempted PATCH",
    );

    const rawImportedSession = await prisma.activitySession.findUniqueOrThrow({
      where: { id: importedSession.id },
    });
    assert.equal(rawImportedSession.source, ABWS_PARSER_KEY, "source must be preserved");
    assert.equal(rawImportedSession.externalId, `ext-${marker}`, "externalId must be preserved");
    assert.equal(rawImportedSession.priceMinCents, 4000, "priceMinCents must be preserved");
    assert.equal(
      rawImportedSession.buyUrl,
      "https://saleframe.24afisha.by/?sid=123",
      "buyUrl must be preserved",
    );
  } finally {
    if (createdActivityIds.length > 0) {
      await prisma.activitySession.deleteMany({ where: { activityId: { in: createdActivityIds } } });
      await prisma.activity.deleteMany({ where: { id: { in: createdActivityIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  }

  console.log("activity.service readonly-import-sessions integration tests: OK");
}

main().catch((error) => {
  console.error("activity.service readonly-import-sessions integration tests: FAILED", error);
  process.exitCode = 1;
});
