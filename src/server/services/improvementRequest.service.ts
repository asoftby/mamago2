/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { ImprovementRequestStatus, ImprovementSeverity } from "@prisma/client";

interface CreateImprovementRequestParams {
  entityType: string;
  entityId: string;
  createdByModeratorId: string;
  assignedToUserId: string;
  severity: ImprovementSeverity;
  title: string;
  description: string;
  requestedChanges?: any;
  dueAt?: Date;
}

/**
 * Get active improvement request for an entity
 * Active = OPEN or IN_PROGRESS status
 * Returns null if no active request exists
 */
export async function getActiveImprovementRequestForEntity(
  entityType: string,
  entityId: string
) {
  const activeRequest = await prisma.improvementRequest.findFirst({
    where: {
      entityType,
      entityId,
      status: {
        in: [ImprovementRequestStatus.OPEN, ImprovementRequestStatus.IN_PROGRESS],
      },
    },
    include: {
      createdByModerator: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      assignedToUser: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc", // Get most recent if somehow multiple exist (legacy data)
    },
  });

  return activeRequest;
}

/**
 * Create an improvement request for a published entity
 * ENFORCES: Only ONE active improvement request per entity
 * If an active request already exists, throws an error
 */
export async function createImprovementRequest(params: CreateImprovementRequestParams) {
  const {
    entityType,
    entityId,
    createdByModeratorId,
    assignedToUserId,
    severity,
    title,
    description,
    requestedChanges,
    dueAt,
  } = params;

  // CRITICAL: Check if an active improvement request already exists
  const existingActiveRequest = await getActiveImprovementRequestForEntity(
    entityType,
    entityId
  );

  if (existingActiveRequest) {
    throw new Error(
      `ACTIVE_REQUEST_EXISTS: An active improvement request already exists for this ${entityType.toLowerCase()} (ID: ${existingActiveRequest.id}). Please resolve or cancel the existing request before creating a new one.`
    );
  }

  // Create the improvement request
  const request = await prisma.improvementRequest.create({
    data: {
      entityType,
      entityId,
      createdByModeratorId,
      assignedToUserId,
      severity,
      title,
      description,
      requestedChanges: requestedChanges || null,
      dueAt: dueAt || null,
      status: ImprovementRequestStatus.OPEN,
    },
    include: {
      createdByModerator: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      assignedToUser: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  // Update entity to mark it has active improvement requests
  if (entityType === "PLACE") {
    await prisma.place.update({
      where: { id: entityId },
      data: { hasActiveImprovementRequests: true },
    });
  }

  return request;
}

/**
 * List improvement requests for an entity
 */
export async function listImprovementRequestsForEntity(
  entityType: string,
  entityId: string,
  includeResolved = false
) {
  const where: any = {
    entityType,
    entityId,
  };

  if (!includeResolved) {
    where.status = {
      in: [ImprovementRequestStatus.OPEN, ImprovementRequestStatus.IN_PROGRESS],
    };
  }

  const requests = await prisma.improvementRequest.findMany({
    where,
    include: {
      createdByModerator: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      assignedToUser: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return requests;
}

/**
 * List active improvement requests for a business owner
 */
export async function listActiveImprovementRequestsForBusiness(userId: string) {
  const requests = await prisma.improvementRequest.findMany({
    where: {
      assignedToUserId: userId,
      status: {
        in: [ImprovementRequestStatus.OPEN, ImprovementRequestStatus.IN_PROGRESS],
      },
    },
    include: {
      createdByModerator: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  });

  return requests;
}

/**
 * Resolve an improvement request
 */
export async function resolveImprovementRequest(
  requestId: string,
  resolvedByRevisionId?: string
) {
  const request = await prisma.improvementRequest.update({
    where: { id: requestId },
    data: {
      status: ImprovementRequestStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedByRevisionId: resolvedByRevisionId || null,
    },
    include: {
      createdByModerator: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      assignedToUser: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  // Check if entity has any other active improvement requests
  const activeCount = await prisma.improvementRequest.count({
    where: {
      entityType: request.entityType,
      entityId: request.entityId,
      status: {
        in: [ImprovementRequestStatus.OPEN, ImprovementRequestStatus.IN_PROGRESS],
      },
    },
  });

  // Update entity flag if no more active requests
  if (activeCount === 0 && request.entityType === "PLACE") {
    await prisma.place.update({
      where: { id: request.entityId },
      data: { hasActiveImprovementRequests: false },
    });
  }

  return request;
}

/**
 * Cancel an improvement request
 */
export async function cancelImprovementRequest(requestId: string) {
  const request = await prisma.improvementRequest.update({
    where: { id: requestId },
    data: {
      status: ImprovementRequestStatus.CANCELLED,
    },
    include: {
      createdByModerator: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      assignedToUser: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  // Check if entity has any other active improvement requests
  const activeCount = await prisma.improvementRequest.count({
    where: {
      entityType: request.entityType,
      entityId: request.entityId,
      status: {
        in: [ImprovementRequestStatus.OPEN, ImprovementRequestStatus.IN_PROGRESS],
      },
    },
  });

  // Update entity flag if no more active requests
  if (activeCount === 0 && request.entityType === "PLACE") {
    await prisma.place.update({
      where: { id: request.entityId },
      data: { hasActiveImprovementRequests: false },
    });
  }

  return request;
}

/**
 * Link a revision to an improvement request
 */
export async function linkRevisionToImprovementRequest(
  revisionId: string,
  improvementRequestId: string
) {
  // Update the revision
  const revision = await prisma.placeRevision.update({
    where: { id: revisionId },
    data: { improvementRequestId },
  });

  // Update improvement request status to IN_PROGRESS
  await prisma.improvementRequest.update({
    where: { id: improvementRequestId },
    data: { status: ImprovementRequestStatus.IN_PROGRESS },
  });

  return revision;
}

/**
 * Auto-resolve improvement request when linked revision is approved
 */
export async function autoResolveImprovementRequestOnApproval(revisionId: string) {
  // Find revision with improvement request link
  const revision = await prisma.placeRevision.findUnique({
    where: { id: revisionId },
    select: { improvementRequestId: true },
  });

  if (!revision?.improvementRequestId) {
    return null;
  }

  // Resolve the improvement request
  return await resolveImprovementRequest(revision.improvementRequestId, revisionId);
}
