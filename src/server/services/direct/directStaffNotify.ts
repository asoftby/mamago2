/**
 * Direct → business staff notifications.
 *
 * Every active OWNER/MANAGER can open the business Direct inbox and answer
 * (see getBusinessMembership), so a customer's new request/message must reach
 * all of them — not only Business.ownerUserId. Recipients are resolved once per
 * event (2 indexed reads, off the request's critical path: callers fire and
 * forget) and each one goes through the existing per-user dedup in
 * notifyDirect*(), so retries never double-notify.
 */
import { BusinessMemberRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  notifyDirectCreated,
  notifyDirectMessage,
  type NotifyDirectCreatedParams,
  type NotifyDirectMessageParams,
} from "@/server/services/notification.service";

/** Active owner + managers of a business, de-duplicated. The owner counts even without a membership row. */
export async function getBusinessDirectRecipientUserIds(businessId: string): Promise<string[]> {
  const [business, members] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { ownerUserId: true } }),
    prisma.businessMember.findMany({
      where: {
        businessId,
        isActive: true,
        role: { in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER] },
      },
      select: { userId: true },
    }),
  ]);
  const ids = new Set(members.map((member) => member.userId));
  if (business?.ownerUserId) ids.add(business.ownerUserId);
  return [...ids];
}

function logRejected(label: string, results: PromiseSettledResult<unknown>[]) {
  for (const result of results) {
    if (result.status === "rejected") console.error(label, result.reason);
  }
}

/** A customer opened a new Direct thread: tell the whole business team. */
export async function notifyBusinessStaffDirectCreated(
  params: Omit<NotifyDirectCreatedParams, "ownerUserId"> & { businessId: string },
) {
  const { businessId, ...rest } = params;
  const recipients = await getBusinessDirectRecipientUserIds(businessId);
  const results = await Promise.allSettled(
    recipients.map((ownerUserId) => notifyDirectCreated({ ...rest, ownerUserId })),
  );
  logRejected("[direct] notifyDirectCreated (staff) failed:", results);
}

/** A customer wrote in a Direct thread: tell the whole business team. */
export async function notifyBusinessStaffDirectMessage(
  params: Omit<NotifyDirectMessageParams, "recipientUserId" | "recipientSurface"> & { businessId: string },
) {
  const { businessId, ...rest } = params;
  const recipients = await getBusinessDirectRecipientUserIds(businessId);
  const results = await Promise.allSettled(
    recipients.map((recipientUserId) =>
      notifyDirectMessage({ ...rest, recipientUserId, recipientSurface: "BUSINESS" }),
    ),
  );
  logRejected("[direct] notifyDirectMessage (staff) failed:", results);
}
