import "server-only";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification.service";

/** One notice per persisted message per recipient. No message body leaves the support DB. */
export async function notifySupportMessage(params: {
  threadId: string;
  businessId: string;
  messageId: string;
  senderId: string;
  actor: "BUSINESS" | "STAFF";
}): Promise<void> {
  try {
    const staffMessage = params.actor === "BUSINESS";
    const recipients = staffMessage
      ? await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "MODERATOR"] }, deletedAt: null },
          select: { id: true },
        })
      : await prisma.businessMember.findMany({
          where: { businessId: params.businessId, isActive: true, role: { in: ["OWNER", "MANAGER"] } },
          select: { userId: true },
        }).then(rows => rows.map(row => ({ id: row.userId })));

    const audience = staffMessage ? "ADMIN" : "BUSINESS";
    const type = staffMessage ? "SUPPORT_STAFF_MESSAGE" : "SUPPORT_BUSINESS_REPLY";
    const url = staffMessage ? "/admin/support?thread=" : "/business/support?thread=";
    for (const recipientId of new Set(recipients.map(row => row.id))) {
      if (recipientId === params.senderId) continue;
      const existing = await prisma.notification.findFirst({
        where: { userId: recipientId, type, entityType: "SYSTEM", entityId: params.messageId },
        select: { id: true },
      });
      if (existing) continue;
      await createNotification({
        userId: recipientId,
        audience,
        type,
        title: staffMessage ? "Новое сообщение в поддержку mamaGo" : "Команда mamaGo ответила",
        body: staffMessage
          ? "Представитель бизнеса написал в поддержку. Откройте обращение в админке."
          : "По вашему обращению есть новый ответ. Откройте переписку в кабинете.",
        entityType: "SYSTEM",
        entityId: params.messageId,
        ctaLabel: "Открыть обращение",
        actionMode: "PAGE",
        actionUrl: url + encodeURIComponent(params.threadId),
      });
    }
  } catch (error) {
    // The support message is persisted first. Notification failure must never
    // turn a successful send into an apparent failure that the user retries.
    console.error("[support] failed to deliver support notices:", error);
  }
}
