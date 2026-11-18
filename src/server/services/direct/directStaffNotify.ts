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
import { BusinessMemberRole, DirectActorType } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  notifyDirectClientWaiting,
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

/** One external (e-mail/Telegram) "client is waiting" ping per thread and recipient per this window… */
export const DIRECT_WAITING_PING_WINDOW_MS = 30 * 60 * 1000;

/**
 * Should this staff member get an external ping for a new customer message?
 * Yes when they have not been pinged about this thread within the window — or when
 * the business has replied since the last ping (a reply closes the "waiting" cycle,
 * so the client's next message is a new one). A new thread already counts as a ping
 * (DIRECT_THREAD_CREATED), so its first message does not ping twice.
 */
export async function shouldPingStaffAboutThread(
  recipientUserId: string,
  threadId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const lastPing = await prisma.notification.findFirst({
    where: {
      userId: recipientUserId,
      entityType: "DIRECT_THREAD",
      entityId: threadId,
      type: { in: ["DIRECT_CLIENT_WAITING", "DIRECT_THREAD_CREATED"] },
      createdAt: { gte: new Date(now.getTime() - DIRECT_WAITING_PING_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!lastPing) return true;

  const repliedSince = await prisma.directMessage.findFirst({
    where: {
      threadId,
      senderType: { in: [DirectActorType.BUSINESS, DirectActorType.ADMIN] },
      createdAt: { gt: lastPing.createdAt },
    },
    select: { id: true },
  });
  return Boolean(repliedSince);
}

/**
 * A customer wrote in a Direct thread: every team member gets the per-message in-app
 * notice (bell), and — throttled — an external "client is waiting" ping.
 */
export async function notifyBusinessStaffDirectMessage(
  params: Omit<NotifyDirectMessageParams, "recipientUserId" | "recipientSurface"> & { businessId: string },
) {
  const { businessId, ...rest } = params;
  const recipients = await getBusinessDirectRecipientUserIds(businessId);
  const results = await Promise.allSettled(
    recipients.map(async (recipientUserId) => {
      await notifyDirectMessage({ ...rest, recipientUserId, recipientSurface: "BUSINESS" });
      if (await shouldPingStaffAboutThread(recipientUserId, rest.threadId)) {
        await notifyDirectClientWaiting({ recipientUserId, threadId: rest.threadId, threadNumber: rest.threadNumber });
      }
    }),
  );
  logRejected("[direct] notifyDirectMessage (staff) failed:", results);
}
