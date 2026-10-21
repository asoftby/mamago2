import prisma from "@/lib/prisma";
import type {
  UserBirthdayParty, UserBirthdayPartyDetail,
  UserBirthdayPartyStatus,
} from "@/features/me/types/userBirthdayParty";
import { PartyOrderStatus, PartyItemStatus } from "@prisma/client";

function statusOfParty(input: {
  status: PartyOrderStatus;
  total: number;
  confirmed: number;
}): UserBirthdayPartyStatus {
  if (input.status === PartyOrderStatus.DRAFT) return "draft";
  if (input.status === PartyOrderStatus.CANCELLED) return "archived";
  if (input.total > 0 && input.confirmed === input.total) return "ready";
  if (input.confirmed > 0) return "partial";
  return "awaiting";
}

/** Canonical PartyOrder records, never fake bookings. */
export async function listUserBirthdayParties(userId: string): Promise<UserBirthdayParty[]> {
  const rows = await prisma.partyOrder.findMany({
    where: { ownerUserId: userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true, ownerUserId: true, childName: true, status: true,
      eventDate: true, timeFrom: true, timeTo: true, updatedAt: true,
      items: { select: {
        role: true, status: true, offer: { select: { title: true } },
      } },
    },
  });
  return rows.map((row) => {
    const countable = row.items.filter((i) => i.role !== "INCLUDED");
    const confirmed = countable.filter((i) => i.status === PartyItemStatus.CONFIRMED).length;
    return {
      id: row.id,
      userId: row.ownerUserId,
      childName: row.childName || "ребёнка",
      title: null,
      status: statusOfParty({ status: row.status, total: countable.length, confirmed }),
      dateIso: row.eventDate?.toISOString().slice(0, 10) ?? null,
      timeStart: row.timeFrom,
      timeEnd: row.timeTo,
      previewItems: row.items.filter((item) => item.role !== "INCLUDED")
        .flatMap((item) => item.offer?.title ? [item.offer.title] : []).slice(0, 4),
      selectedServiceCount: countable.length,
      confirmationCount: confirmed,
      confirmationTotal: countable.length,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

/** Legacy demo format is intentionally not used for persisted PartyOrder details. */
export async function getUserBirthdayPartyDetail(
  userId: string,
  partyId: string,
): Promise<UserBirthdayPartyDetail | null> {
  void userId;
  void partyId;
  return null;
}
