import "server-only";

import prisma from "@/lib/prisma";
import type { NotificationScenario } from "@/lib/notifications/domainContracts";
import { buildNotificationDedupeKeyCore } from "./notification-dedupe-core";

type DedupeLookupArgs = {
  scenario: NotificationScenario;
  dedupeKey: string;
};

export function buildNotificationDedupeKey(args: {
  scenario: NotificationScenario;
  userId: string;
  eventId: string;
}): string {
  return buildNotificationDedupeKeyCore(args);
}

export async function hasSuccessfulNotificationDelivery(
  args: DedupeLookupArgs,
): Promise<boolean> {
  const existing = await prisma.notificationDelivery.findFirst({
    where: {
      scenario: args.scenario,
      dedupeKey: args.dedupeKey,
      status: "SENT",
    },
    select: { id: true },
  });

  return Boolean(existing);
}
