/**
 * Direct access control.
 *
 * Reuses the existing business-ownership chain (business-permissions /
 * activityAccess) instead of introducing a new participant model — the two
 * participants of a DirectThread are always known up front:
 *   - customer: DirectThread.customerUserId (the User who initiated it)
 *   - business: DirectThread.businessId (resolved at creation time from the
 *     owning publication, see resolveBusinessFromPublication in
 *     directThread.service.ts)
 *
 * Visibility rules:
 *   - Customer sees only threads where they are the customer.
 *   - Business sees only threads on publications it owns (membership via
 *     canAccessBusinessResource — OWNER/MANAGER, or ADMIN ops override).
 *   - Admin/Moderator sees everything.
 *   - There is no "business creates a thread" path — see
 *     createDirectThread() in directThread.service.ts, which always takes
 *     the authenticated customer as the initiator.
 */

import { NextResponse } from "next/server";
import type { AuthActor } from "@/lib/auth/safeUser";
import prisma from "@/lib/prisma";
import { canAccessBusinessResource } from "@/server/permissions/business-permissions";
import { getBusinessIdsUserCanAccess } from "@/lib/auth/activityAccess";

export class DirectAccessError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404,
    message: string,
  ) {
    super(message);
    this.name = "DirectAccessError";
  }
}

export function isDirectAccessError(e: unknown): e is DirectAccessError {
  return e instanceof DirectAccessError;
}

/** Converts a thrown DirectAccessError into a ready-to-return NextResponse, or null if not one. */
export function nextResponseFromDirectAccessError(error: unknown): NextResponse | null {
  if (isDirectAccessError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

type ThreadParticipants = {
  customerUserId: string;
  businessId: string;
};

/**
 * Core visibility check for a single thread. No throw — callers that need
 * HTTP semantics should use requireDirectThreadAccess instead.
 */
export async function canAccessDirectThread(
  user: AuthActor | null,
  thread: ThreadParticipants,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "MODERATOR") return true;
  if (user.id === thread.customerUserId) return true;
  return canAccessBusinessResource(user, thread.businessId);
}

/**
 * Fetches the thread and enforces visibility. Throws DirectAccessError
 * (401/403/404) rather than returning a boolean, for direct use in route
 * handlers / server actions.
 */
export async function requireDirectThreadAccess(
  user: AuthActor | null,
  threadId: string,
): Promise<ThreadParticipants & { id: string; status: string }> {
  if (!user) {
    throw new DirectAccessError(401, "Authentication required");
  }

  const thread = await prisma.directThread.findUnique({
    where: { id: threadId },
    select: { id: true, customerUserId: true, businessId: true, status: true },
  });

  if (!thread) {
    throw new DirectAccessError(404, "Direct thread not found");
  }

  const allowed = await canAccessDirectThread(user, thread);
  if (!allowed) {
    throw new DirectAccessError(403, "Forbidden");
  }

  return thread;
}

/**
 * Prisma `where` fragment for listing threads visible to this user:
 * customer's own threads, OR threads of every business they can access.
 * Admin/Moderator get no filter (see everything).
 */
export async function buildDirectThreadWhereForUser(
  user: AuthActor,
): Promise<Record<string, unknown>> {
  if (user.role === "ADMIN" || user.role === "MODERATOR") {
    return {};
  }

  const businessIds = await getBusinessIdsUserCanAccess(user.id);

  const or: Record<string, unknown>[] = [{ customerUserId: user.id }];
  if (businessIds.length > 0) {
    or.push({ businessId: { in: businessIds } });
  }
  return { OR: or };
}

/**
 * Admin/Moderator gate for moderation actions (hide message, block/unblock
 * thread, review complaint). Separate from canAccessDirectThread because
 * moderation is never available to customer/business participants.
 */
export function isDirectModerator(user: AuthActor | null): boolean {
  return user?.role === "ADMIN" || user?.role === "MODERATOR";
}

/**
 * Resolves which side an already-authorized user is posting as.
 * ADMIN/MODERATOR map to DirectActorType.ADMIN (a live staff intervention,
 * distinct from the SYSTEM automated actor) rather than CUSTOMER/BUSINESS —
 * must only be called after requireDirectThreadAccess has confirmed access.
 */
export function resolveDirectActorType(
  user: AuthActor,
  thread: ThreadParticipants,
): "CUSTOMER" | "BUSINESS" | "ADMIN" {
  if (user.role === "ADMIN" || user.role === "MODERATOR") return "ADMIN";
  if (user.id === thread.customerUserId) return "CUSTOMER";
  return "BUSINESS";
}
