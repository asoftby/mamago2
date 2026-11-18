import "server-only";

import type { PrismaClient } from "@prisma/client";
import {
  canTransitionGovernmentRequest,
  type CreateGovernmentRequestInput,
  type UpdateGovernmentRequestInput,
} from "./governmentRequests.policy";

export const GOVERNMENT_REQUEST_ENTITY = "GOVERNMENT_DATA_REQUEST";
const PAGE_SIZE = 50;

export type GovernmentRequestActor = { id: string; role: string };

export class GovernmentRequestForbiddenError extends Error {}
export class GovernmentRequestNotFoundError extends Error {}
export class GovernmentRequestConflictError extends Error {}

function assertAdmin(actor: GovernmentRequestActor): void {
  if (actor.role !== "ADMIN") throw new GovernmentRequestForbiddenError("Forbidden");
}

export async function listGovernmentRequests(
  db: PrismaClient,
  actor: GovernmentRequestActor,
  page: number,
) {
  assertAdmin(actor);
  const safePage = Number.isSafeInteger(page) && page >= 1 && page <= 10000 ? page : 1;
  return db.$transaction(async (tx) => {
    const rows = await tx.governmentDataRequest.findMany({
      select: {
        id: true,
        authorityName: true,
        incomingNumber: true,
        receivedAt: true,
        status: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    });
    // A read must not be returned if its audit record could not be committed.
    await tx.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: "GOVERNMENT_REQUEST_REGISTRY_VIEWED",
        entityType: GOVERNMENT_REQUEST_ENTITY,
        entityId: "registry",
        metadata: { page: safePage },
      },
    });
    return { items: rows.slice(0, PAGE_SIZE), page: safePage, hasMore: rows.length > PAGE_SIZE };
  });
}

export async function getGovernmentRequest(
  db: PrismaClient,
  actor: GovernmentRequestActor,
  id: string,
) {
  assertAdmin(actor);
  return db.$transaction(async (tx) => {
    const found = await tx.governmentDataRequest.findUnique({ where: { id } });
    if (!found) throw new GovernmentRequestNotFoundError("Not found");
    await tx.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: "GOVERNMENT_REQUEST_VIEWED",
        entityType: GOVERNMENT_REQUEST_ENTITY,
        entityId: id,
      },
    });
    const history = await tx.adminAuditLog.findMany({
      where: { entityType: GOVERNMENT_REQUEST_ENTITY, entityId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, actorId: true, action: true, reason: true, createdAt: true },
    });
    return { case: found, history };
  });
}

export async function createGovernmentRequest(
  db: PrismaClient,
  actor: GovernmentRequestActor,
  input: CreateGovernmentRequestInput,
) {
  assertAdmin(actor);
  return db.$transaction(async (tx) => {
    const created = await tx.governmentDataRequest.create({
      data: {
        authorityName: input.authorityName,
        incomingNumber: input.incomingNumber,
        receivedAt: new Date(input.receivedDate + "T00:00:00.000Z"),
        legalBasis: input.legalBasis,
        requestedScope: input.requestedScope,
        subjectUserId: input.subjectUserId || null,
        createdById: actor.id,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: "GOVERNMENT_REQUEST_CREATED",
        entityType: GOVERNMENT_REQUEST_ENTITY,
        entityId: created.id,
        after: { status: created.status },
        // No legalBasis, scope, subjectUserId or other case content in logs.
      },
    });
    return created;
  });
}

export async function updateGovernmentRequest(
  db: PrismaClient,
  actor: GovernmentRequestActor,
  id: string,
  input: UpdateGovernmentRequestInput,
) {
  assertAdmin(actor);
  return db.$transaction(async (tx) => {
    const found = await tx.governmentDataRequest.findUnique({ where: { id } });
    if (!found) throw new GovernmentRequestNotFoundError("Not found");
    if (!canTransitionGovernmentRequest(found.status, input.status)) {
      throw new GovernmentRequestConflictError("Invalid or terminal status transition");
    }
    const changed = await tx.governmentDataRequest.updateMany({
      where: { id, status: found.status },
      data: {
        status: input.status,
        resolutionNote: input.resolutionNote?.trim() || null,
      },
    });
    if (changed.count !== 1) {
      throw new GovernmentRequestConflictError("Concurrent update");
    }
    const updated = await tx.governmentDataRequest.findUniqueOrThrow({ where: { id } });
    await tx.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: "GOVERNMENT_REQUEST_STATUS_CHANGED",
        entityType: GOVERNMENT_REQUEST_ENTITY,
        entityId: id,
        before: { status: found.status },
        after: { status: updated.status },
        // Reason text can contain identifiers; log its presence only.
        metadata: { resolutionNotePresent: Boolean(input.resolutionNote?.trim()) },
      },
    });
    return updated;
  });
}
