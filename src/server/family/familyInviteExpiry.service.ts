import { Prisma, type PrismaClient } from "@prisma/client";
import { FAMILY_INVITE_TTL_MS } from "./familyInvitePure";

const BATCH_SIZE = 100;

type ExpiredInviteRow = { id: string; createdById: string };

/**
 * Notify the inviter once when an unused link expires. Existing NULL-expiry
 * links expire seven days after their creation too.
 *
 * Row-level locking plus deterministic Notification IDs prevent duplicate
 * notices across overlapping workers, without resetting membership or
 * attempting to send to an unknown invitee (email is intentionally not stored).
 * Invitees see expiry on the link landing page.
 */
export async function notifyExpiredFamilyInvites(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<number> {
  const legacyCutoff = new Date(now.getTime() - FAMILY_INVITE_TTL_MS);
  return prisma.$transaction(async (tx) => {
    const invites = await tx.$queryRaw<ExpiredInviteRow[]>(Prisma.sql`
      SELECT fi."id", fi."createdById"
      FROM "FamilyInvite" fi
      WHERE fi."status" = 'ACTIVE'
        AND (
          fi."expiresAt" <= ${now}
          OR (fi."expiresAt" IS NULL AND fi."createdAt" <= ${legacyCutoff})
        )
        AND NOT EXISTS (
          SELECT 1 FROM "Notification" n
          WHERE n."id" = ('family-invite-expired:' || fi."id")
        )
      ORDER BY fi."createdAt" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE OF fi SKIP LOCKED
    `);
    if (invites.length === 0) return 0;
    const result = await tx.notification.createMany({
      data: invites.map((invite) => ({
        id: `family-invite-expired:${invite.id}`,
        userId: invite.createdById,
        type: "SYSTEM_INFO",
        title: "Срок приглашения в семью истёк",
        body: "Приглашение действовало 7 дней и не было принято. При необходимости создайте новую ссылку.",
        actionMode: "PAGE",
        actionUrl: "/me/profile",
        ctaLabel: "Открыть семью",
      })),
      skipDuplicates: true,
    });
    return result.count;
  });
}
