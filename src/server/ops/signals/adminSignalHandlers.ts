/**
 * Operations Center signal mutation handlers (§21 UI phase).
 *
 * Minimal mutation surface required by the new /admin dashboard —
 * acknowledge, snooze, manual resolve — over the existing
 * `OperationalSignal` schema (already carries acknowledgedAt/acknowledgedBy/
 * snoozedUntil/resolvedAt/resolution/resolvedBy from the frozen backend).
 * No new detector, no registry change, no schema change.
 *
 * Testable core, following the same pattern as adminRankingHandlers.ts:
 * auth resolution (cookies() via next/headers) cannot run outside a real
 * Next.js request scope, so each `route.ts` wrapper resolves `actor` via
 * requireAdminApiUser()/requireAdminOrModeratorApiUser() and passes it in
 * here — this module is exercised directly by adminSignalHandlers.test.ts
 * against a real DB.
 *
 * Atomicity: the OperationalSignal state mutation and its AdminAuditLog
 * row are written in ONE `prisma.$transaction`. The audit insert is
 * written directly here via `tx.adminAuditLog.create` (not the shared
 * `logAdminAudit()` helper, which always uses the top-level `prisma`
 * singleton and so cannot participate in this transaction) — if the audit
 * insert fails for any reason, the whole transaction rolls back and the
 * signal mutation never commits either. Never a legacy `AuditLog` write.
 *
 * Concurrency: every mutation reads the current row, then performs a
 * single guarded `updateMany({ where: { id, status: "OPEN", ... } })`,
 * all inside the same transaction. Under Postgres's default READ
 * COMMITTED isolation, an UPDATE re-checks its WHERE clause against the
 * latest committed row before applying — so if the detector reconciliation
 * loop concurrently auto-resolved the same signal in its own transaction,
 * this update matches zero rows once that transaction commits, and the
 * handler reports a clean 409 conflict instead of silently reopening or
 * corrupting terminal state.
 *
 * DB time discipline: acknowledgedAt/snoozedUntil/resolvedAt all use
 * `getDbNow(tx)` (the same DB-observed instant the transaction operates
 * on), never `new Date()`.
 */
import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { getDbNow } from "../dbTime";
import { computeSnoozeUntil, isSnoozeChoice, type SnoozeChoice } from "./computeSnoozeUntil";

export interface SignalActor {
  id: string;
  role: Role;
}

export interface SignalHandlerResult {
  status: number;
  body: unknown;
}

const ENTITY_TYPE = "OPERATIONAL_SIGNAL";

type Tx = Prisma.TransactionClient;

function isAckSnoozeAllowed(actor: SignalActor | null): actor is SignalActor {
  return !!actor && (actor.role === "ADMIN" || actor.role === "MODERATOR");
}

function isResolveAllowed(actor: SignalActor | null): actor is SignalActor {
  return !!actor && actor.role === "ADMIN";
}

interface WriteAuditParams {
  actor: SignalActor;
  action: string;
  entityId: string;
  before: Prisma.InputJsonValue;
  after: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

/** Same transaction as the signal mutation — never the shared logAdminAudit() singleton call. */
async function writeSignalAudit(tx: Tx, params: WriteAuditParams): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      actorId: params.actor.id,
      actorRole: params.actor.role,
      action: params.action,
      entityType: ENTITY_TYPE,
      entityId: params.entityId,
      before: params.before,
      after: params.after,
      metadata: params.metadata,
    },
  });
}

export async function handleAcknowledgeSignal(
  prisma: PrismaClient,
  actor: SignalActor | null,
  signalId: string,
): Promise<SignalHandlerResult> {
  if (!isAckSnoozeAllowed(actor)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  const resolvedActor = actor;

  return prisma.$transaction(async (tx) => {
    const current = await tx.operationalSignal.findUnique({ where: { id: signalId } });
    if (!current) {
      return { status: 404, body: { error: "Signal not found" } };
    }
    if (current.status !== "OPEN") {
      return { status: 409, body: { error: "Signal is not OPEN", status: current.status } };
    }
    if (current.acknowledgedAt) {
      // Idempotent no-op — already acknowledged, do not re-write or re-audit.
      return { status: 200, body: current };
    }

    const now = await getDbNow(tx);
    const result = await tx.operationalSignal.updateMany({
      where: { id: signalId, status: "OPEN", acknowledgedAt: null },
      data: { acknowledgedAt: now, acknowledgedBy: resolvedActor.id },
    });

    if (result.count === 0) {
      const latest = await tx.operationalSignal.findUnique({ where: { id: signalId } });
      if (!latest || latest.status !== "OPEN") {
        return { status: 409, body: { error: "Signal is not OPEN", status: latest?.status ?? "UNKNOWN" } };
      }
      // Raced with a concurrent acknowledge — already-acknowledged is success.
      return { status: 200, body: latest };
    }

    const updated = await tx.operationalSignal.findUniqueOrThrow({ where: { id: signalId } });
    await writeSignalAudit(tx, {
      actor: resolvedActor,
      action: "OPERATIONAL_SIGNAL_ACKNOWLEDGED",
      entityId: signalId,
      before: { fingerprint: current.fingerprint, acknowledgedAt: null },
      after: { fingerprint: current.fingerprint, acknowledgedAt: updated.acknowledgedAt },
    });

    return { status: 200, body: updated };
  });
}

export async function handleSnoozeSignal(
  prisma: PrismaClient,
  actor: SignalActor | null,
  signalId: string,
  choice: unknown,
): Promise<SignalHandlerResult> {
  if (!isAckSnoozeAllowed(actor)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  if (!isSnoozeChoice(choice)) {
    return { status: 400, body: { error: "Invalid snooze duration" } };
  }
  const resolvedActor = actor;
  const resolvedChoice = choice;

  return prisma.$transaction(async (tx) => {
    const current = await tx.operationalSignal.findUnique({ where: { id: signalId } });
    if (!current) {
      return { status: 404, body: { error: "Signal not found" } };
    }
    if (current.status !== "OPEN") {
      return { status: 409, body: { error: "Signal is not OPEN", status: current.status } };
    }

    const now = await getDbNow(tx);
    const snoozedUntil = computeSnoozeUntil(now, resolvedChoice as SnoozeChoice);

    const result = await tx.operationalSignal.updateMany({
      where: { id: signalId, status: "OPEN" },
      data: { snoozedUntil },
    });

    if (result.count === 0) {
      const latest = await tx.operationalSignal.findUnique({ where: { id: signalId } });
      return { status: 409, body: { error: "Signal is not OPEN", status: latest?.status ?? "UNKNOWN" } };
    }

    const updated = await tx.operationalSignal.findUniqueOrThrow({ where: { id: signalId } });
    await writeSignalAudit(tx, {
      actor: resolvedActor,
      action: "OPERATIONAL_SIGNAL_SNOOZED",
      entityId: signalId,
      before: { fingerprint: current.fingerprint, snoozedUntil: current.snoozedUntil },
      after: { fingerprint: current.fingerprint, snoozedUntil: updated.snoozedUntil },
      metadata: { choice: resolvedChoice },
    });

    return { status: 200, body: updated };
  });
}

export async function handleResolveSignal(
  prisma: PrismaClient,
  actor: SignalActor | null,
  signalId: string,
): Promise<SignalHandlerResult> {
  if (!isResolveAllowed(actor)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  const resolvedActor = actor;

  return prisma.$transaction(async (tx) => {
    const current = await tx.operationalSignal.findUnique({ where: { id: signalId } });
    if (!current) {
      return { status: 404, body: { error: "Signal not found" } };
    }
    if (current.status !== "OPEN") {
      return { status: 409, body: { error: "Signal is already terminal", status: current.status } };
    }

    const now = await getDbNow(tx);
    const result = await tx.operationalSignal.updateMany({
      where: { id: signalId, status: "OPEN" },
      data: { status: "RESOLVED", resolution: "MANUAL", resolvedAt: now, resolvedBy: resolvedActor.id },
    });

    if (result.count === 0) {
      const latest = await tx.operationalSignal.findUnique({ where: { id: signalId } });
      return { status: 409, body: { error: "Signal is already terminal", status: latest?.status ?? "UNKNOWN" } };
    }

    const updated = await tx.operationalSignal.findUniqueOrThrow({ where: { id: signalId } });
    await writeSignalAudit(tx, {
      actor: resolvedActor,
      action: "OPERATIONAL_SIGNAL_RESOLVED",
      entityId: signalId,
      before: { fingerprint: current.fingerprint, status: current.status },
      after: { fingerprint: current.fingerprint, status: updated.status, resolution: updated.resolution },
    });

    return { status: 200, body: updated };
  });
}
