import "server-only";

import prisma from "@/lib/prisma";
import type { SmsByFailureReason } from "@/lib/sms/smsByResponse";

/**
 * Best-effort admin alert for failed SMS dispatch. One alert per admin per
 * 15 minutes; no recipient phone, OTP, token or raw provider body is stored.
 * Never lets a notification failure prevent an OTP error response.
 */
export async function reportSmsByFailure(params: {
  reason: SmsByFailureReason;
  httpStatus?: number;
}): Promise<void> {
  console.error("[sms-by] delivery failure", {
    reason: params.reason,
    httpStatus: params.httpStatus ?? null,
  });

  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    const since = new Date(Date.now() - 15 * 60 * 1000);
    for (const admin of admins) {
      const recent = await prisma.notification.findFirst({
        where: {
          userId: admin.id,
          audience: "ADMIN",
          type: "SYSTEM",
          title: "Сбой отправки SMS",
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (recent) continue;
      await prisma.notification.create({
        data: {
          userId: admin.id,
          audience: "ADMIN",
          type: "SYSTEM",
          title: "Сбой отправки SMS",
          body: "Приём сообщения провайдером sms.by не подтверждён. Проверьте настройки, баланс провайдера и техническую диагностику.",
          actionMode: "PAGE",
          actionUrl: "/admin/system/notifications",
          metadata: {
            event: "SMS_BY_SEND_FAILED",
            reason: params.reason,
            httpStatus: params.httpStatus ?? null,
          },
        },
      });
    }
  } catch {
    console.error("[sms-by] admin failure alert could not be persisted");
  }
}
