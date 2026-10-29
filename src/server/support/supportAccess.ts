import type { AuthActor } from "@/lib/auth/safeUser";
import { canAccessBusinessResource } from "@/server/permissions/business-permissions";
import { prisma } from "@/lib/prisma";

export class SupportAccessError extends Error {
  constructor(public readonly status: 401 | 403 | 404, message: string) {
    super(message);
    this.name = "SupportAccessError";
  }
}

export function isSupportStaff(actor: Pick<AuthActor, "role"> | null): boolean {
  return actor?.role === "ADMIN" || actor?.role === "MODERATOR";
}

/** Staff read access is explicit; unlike Direct, customers are never participants. */
export async function requireSupportBusinessAccess(
  actor: AuthActor | null,
  businessId: string,
): Promise<void> {
  if (!actor) throw new SupportAccessError(401, "Authentication required");
  if (isSupportStaff(actor)) return;
  if (!await canAccessBusinessResource(actor, businessId)) {
    throw new SupportAccessError(404, "Support conversation not found");
  }
}

/** Never return a thread before checking its business membership. */
export async function requireSupportThreadAccess(
  actor: AuthActor | null,
  threadId: string,
) {
  if (!actor) throw new SupportAccessError(401, "Authentication required");
  const thread = await prisma.supportThread.findUnique({
    where: { id: threadId },
    select: { id: true, businessId: true, status: true },
  });
  if (!thread) throw new SupportAccessError(404, "Support conversation not found");
  await requireSupportBusinessAccess(actor, thread.businessId);
  return thread;
}

/** Staff replies are always branded as STAFF; never impersonate a business. */
export function requireSupportMessageActor(
  actor: AuthActor,
  requested: "BUSINESS" | "STAFF",
): void {
  if (isSupportStaff(actor) !== (requested === "STAFF")) {
    throw new SupportAccessError(403, "Invalid support sender");
  }
}
