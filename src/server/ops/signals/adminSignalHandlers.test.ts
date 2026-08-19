/**
 * Operations Center signal mutation handler tests (§21 UI phase).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/signals/adminSignalHandlers.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  handleAcknowledgeSignal,
  handleSnoozeSignal,
  handleResolveSignal,
  type SignalActor,
} from "./adminSignalHandlers";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
const marker = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdSignalIds: string[] = [];

async function makeActor(role: "ADMIN" | "MODERATOR" | "USER"): Promise<SignalActor> {
  const user = await prisma.user.create({
    data: { email: `signal-mutation-${marker}-${randomUUID()}@example.invalid`, role },
  });
  createdUserIds.push(user.id);
  return { id: user.id, role: user.role };
}

async function makeSignal(overrides: {
  status?: "PENDING" | "OPEN" | "ABORTED" | "RESOLVED";
  severity?: "CRITICAL" | "WARNING";
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
  resolution?: "AUTO" | "MANUAL" | "ABORTED" | null;
}) {
  const status = overrides.status ?? "OPEN";
  const now = new Date();
  const signal = await prisma.operationalSignal.create({
    data: {
      fingerprint: `signal-mutation-test-${marker}-${randomUUID()}`,
      detector: `signal-mutation-test-${marker}`,
      type: "test",
      status,
      severity: overrides.severity ?? "WARNING",
      title: "mutation test signal",
      firstSeenAt: now,
      lastSeenAt: now,
      openedAt: status === "PENDING" ? null : now,
      attentionChangedAt: status === "PENDING" ? null : now,
      acknowledgedAt: overrides.acknowledgedAt ?? null,
      resolvedAt: overrides.resolvedAt ?? null,
      resolution: overrides.resolution ?? null,
    },
  });
  createdSignalIds.push(signal.id);
  return signal;
}

async function cleanup() {
  await prisma.adminAuditLog.deleteMany({ where: { entityId: { in: createdSignalIds } } });
  await prisma.operationalSignal.deleteMany({ where: { id: { in: createdSignalIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
}

async function main() {
  try {
    const admin = await makeActor("ADMIN");
    const moderator = await makeActor("MODERATOR");
    const plainUser = await makeActor("USER");

    // ===== ACKNOWLEDGE =====

    // OPEN -> OPEN, acknowledgedAt/acknowledgedBy set, AdminAuditLog written, no AuditLog row.
    {
      const signal = await makeSignal({});
      const auditBefore = await prisma.adminAuditLog.count();
      const legacyBefore = await prisma.auditLog.count();

      const result = await handleAcknowledgeSignal(prisma, moderator, signal.id);
      assert.equal(result.status, 200);
      const body = result.body as { status: string; acknowledgedAt: Date | null; acknowledgedBy: string | null };
      assert.equal(body.status, "OPEN", "must remain OPEN");
      assert.ok(body.acknowledgedAt, "acknowledgedAt must be set");
      assert.equal(body.acknowledgedBy, moderator.id);

      assert.equal(await prisma.adminAuditLog.count(), auditBefore + 1, "must write exactly 1 AdminAuditLog row");
      assert.equal(await prisma.auditLog.count(), legacyBefore, "must never write a legacy AuditLog row");

      const auditRow = await prisma.adminAuditLog.findFirst({
        where: { entityId: signal.id, action: "OPERATIONAL_SIGNAL_ACKNOWLEDGED" },
        orderBy: { createdAt: "desc" },
      });
      assert.equal(auditRow?.actorId, moderator.id);
      assert.equal(auditRow?.actorRole, "MODERATOR");
    }

    // Idempotent: acknowledging an already-acknowledged OPEN signal is a clean no-op.
    {
      const now = new Date();
      const signal = await makeSignal({ acknowledgedAt: now });
      const auditBefore = await prisma.adminAuditLog.count();

      const result = await handleAcknowledgeSignal(prisma, admin, signal.id);
      assert.equal(result.status, 200);
      const body = result.body as { acknowledgedAt: Date };
      assert.equal(body.acknowledgedAt.getTime(), now.getTime(), "must not overwrite the existing acknowledgedAt");
      assert.equal(await prisma.adminAuditLog.count(), auditBefore, "idempotent ack must not write a new audit row");
    }

    // Terminal signal cannot be acknowledged.
    {
      const signal = await makeSignal({ status: "RESOLVED", resolvedAt: new Date(), resolution: "AUTO" });
      const result = await handleAcknowledgeSignal(prisma, admin, signal.id);
      assert.equal(result.status, 409);
    }

    // USER role rejected.
    {
      const signal = await makeSignal({});
      const result = await handleAcknowledgeSignal(prisma, plainUser, signal.id);
      assert.equal(result.status, 401);
      const after = await prisma.operationalSignal.findUniqueOrThrow({ where: { id: signal.id } });
      assert.equal(after.acknowledgedAt, null, "rejected actor must not mutate the row");
    }

    // ===== SNOOZE =====

    // OPEN remains OPEN, snoozedUntil set, AdminAuditLog written, severity unchanged.
    {
      const signal = await makeSignal({ severity: "CRITICAL" });
      const auditBefore = await prisma.adminAuditLog.count();

      const result = await handleSnoozeSignal(prisma, admin, signal.id, "24h");
      assert.equal(result.status, 200);
      const body = result.body as { status: string; snoozedUntil: Date | null; severity: string };
      assert.equal(body.status, "OPEN");
      assert.ok(body.snoozedUntil, "snoozedUntil must be set");
      assert.equal(body.severity, "CRITICAL", "snooze must not alter severity");
      assert.equal(await prisma.adminAuditLog.count(), auditBefore + 1);
    }

    // snoozedUntil correctly derived from DB time, not resolved/deleted.
    {
      const signal = await makeSignal({});
      const before = await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const result = await handleSnoozeSignal(prisma, admin, signal.id, "1h");
      const after = await prisma.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const body = result.body as { snoozedUntil: string; status: string };
      const snoozedUntilMs = new Date(body.snoozedUntil).getTime();
      assert.ok(
        snoozedUntilMs >= before[0].now.getTime() + 55 * 60_000 && snoozedUntilMs <= after[0].now.getTime() + 65 * 60_000,
        "snoozedUntil must be ~1h from DB time",
      );
      assert.equal(body.status, "OPEN", "snooze must not resolve the signal");
    }

    // Invalid duration rejected.
    {
      const signal = await makeSignal({});
      const result = await handleSnoozeSignal(prisma, admin, signal.id, "999d");
      assert.equal(result.status, 400);
    }

    // Terminal signal rejected.
    {
      const signal = await makeSignal({ status: "RESOLVED", resolvedAt: new Date(), resolution: "AUTO" });
      const result = await handleSnoozeSignal(prisma, admin, signal.id, "1h");
      assert.equal(result.status, 409);
    }

    // ===== MANUAL RESOLVE =====

    // ADMIN allowed: status RESOLVED, resolution MANUAL, resolvedAt/resolvedBy set, audit written.
    {
      const signal = await makeSignal({});
      const auditBefore = await prisma.adminAuditLog.count();
      const legacyBefore = await prisma.auditLog.count();

      const result = await handleResolveSignal(prisma, admin, signal.id);
      assert.equal(result.status, 200);
      const body = result.body as {
        status: string;
        resolution: string | null;
        resolvedAt: Date | null;
        resolvedBy: string | null;
      };
      assert.equal(body.status, "RESOLVED");
      assert.equal(body.resolution, "MANUAL");
      assert.ok(body.resolvedAt);
      assert.equal(body.resolvedBy, admin.id);

      assert.equal(await prisma.adminAuditLog.count(), auditBefore + 1);
      assert.equal(await prisma.auditLog.count(), legacyBefore, "must never write a legacy AuditLog row");
    }

    // MODERATOR rejected.
    {
      const signal = await makeSignal({});
      const result = await handleResolveSignal(prisma, moderator, signal.id);
      assert.equal(result.status, 401, "MODERATOR must be rejected for manual resolve");
      const after = await prisma.operationalSignal.findUniqueOrThrow({ where: { id: signal.id } });
      assert.equal(after.status, "OPEN", "rejected actor must not mutate the row");
    }

    // Already-resolved conflict handled cleanly, not a 500.
    {
      const signal = await makeSignal({ status: "RESOLVED", resolvedAt: new Date(), resolution: "AUTO" });
      const result = await handleResolveSignal(prisma, admin, signal.id);
      assert.equal(result.status, 409);
    }

    // ===== CONCURRENCY: detector auto-resolve race must not be overwritten =====
    {
      const signal = await makeSignal({});
      // Simulate the worker's reconciliation loop auto-resolving the signal
      // concurrently, between the handler's initial read and its guarded write.
      await prisma.operationalSignal.update({
        where: { id: signal.id },
        data: { status: "RESOLVED", resolution: "AUTO", resolvedAt: new Date() },
      });

      const ackResult = await handleAcknowledgeSignal(prisma, admin, signal.id);
      assert.equal(ackResult.status, 409, "acknowledge must not reopen an auto-resolved signal");

      const resolveResult = await handleResolveSignal(prisma, admin, signal.id);
      assert.equal(resolveResult.status, 409, "manual resolve must not overwrite an already-resolved terminal state");

      const finalState = await prisma.operationalSignal.findUniqueOrThrow({ where: { id: signal.id } });
      assert.equal(finalState.status, "RESOLVED");
      assert.equal(finalState.resolution, "AUTO", "the auto-resolution must remain untouched");
    }

    // ===== ATOMICITY: signal mutation and AdminAuditLog write are one transaction =====
    //
    // A real (non-mocked) forced failure: an actor whose id does not exist
    // in User. Authorization only checks actor.role, so this passes the
    // permission gate, but AdminAuditLog.actorId carries a real FK to User
    // — the audit insert genuinely fails with a foreign-key violation. If
    // the signal mutation and the audit write are in the same transaction,
    // the whole thing rolls back and the signal is left completely
    // untouched; if they were two separate writes (the bug being fixed
    // here), the signal mutation would have already committed.
    {
      const ghostActor = { id: `ghost-actor-${randomUUID()}`, role: "ADMIN" as const };

      const ackSignal = await makeSignal({});
      const auditBefore1 = await prisma.adminAuditLog.count();
      await assert.rejects(
        () => handleAcknowledgeSignal(prisma, ghostActor, ackSignal.id),
        "acknowledge must reject (not swallow) when the audit insert violates the actor FK",
      );
      const ackAfter = await prisma.operationalSignal.findUniqueOrThrow({ where: { id: ackSignal.id } });
      assert.equal(ackAfter.status, "OPEN", "acknowledge rollback: status must be untouched");
      assert.equal(ackAfter.acknowledgedAt, null, "acknowledge rollback: acknowledgedAt must NOT have committed");
      assert.equal(await prisma.adminAuditLog.count(), auditBefore1, "acknowledge rollback: no audit row must exist");

      const snoozeSignal = await makeSignal({});
      const auditBefore2 = await prisma.adminAuditLog.count();
      await assert.rejects(
        () => handleSnoozeSignal(prisma, ghostActor, snoozeSignal.id, "1h"),
        "snooze must reject (not swallow) when the audit insert violates the actor FK",
      );
      const snoozeAfter = await prisma.operationalSignal.findUniqueOrThrow({ where: { id: snoozeSignal.id } });
      assert.equal(snoozeAfter.status, "OPEN", "snooze rollback: status must be untouched");
      assert.equal(snoozeAfter.snoozedUntil, null, "snooze rollback: snoozedUntil must NOT have committed");
      assert.equal(await prisma.adminAuditLog.count(), auditBefore2, "snooze rollback: no audit row must exist");

      const resolveSignal = await makeSignal({});
      const auditBefore3 = await prisma.adminAuditLog.count();
      await assert.rejects(
        () => handleResolveSignal(prisma, ghostActor, resolveSignal.id),
        "manual resolve must reject (not swallow) when the audit insert violates the actor FK",
      );
      const resolveAfter = await prisma.operationalSignal.findUniqueOrThrow({ where: { id: resolveSignal.id } });
      assert.equal(resolveAfter.status, "OPEN", "resolve rollback: status must be untouched, not RESOLVED");
      assert.equal(resolveAfter.resolvedAt, null, "resolve rollback: resolvedAt must NOT have committed");
      assert.equal(await prisma.adminAuditLog.count(), auditBefore3, "resolve rollback: no audit row must exist");
    }

    console.log("adminSignalHandlers.test.ts: OK");
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
