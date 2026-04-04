import type { Prisma } from "@prisma/client";

/**
 * Контент владельца с отключённым бизнесом не показываем в публичной выдаче.
 * Владелец без записи Business — условие «не отключён» (нет связи).
 */
export const activityOwnerBusinessActiveWhere: Prisma.ActivityWhereInput = {
  OR: [
    { owner: { business: { is: null } } },
    { owner: { business: { operationalStatus: "ACTIVE" } } },
  ],
};

export const placeOwnerBusinessActiveWhere: Prisma.PlaceWhereInput = {
  OR: [
    { ownerBusiness: { is: null } }, // No business owner
    { ownerBusiness: { operationalStatus: "ACTIVE" } }, // Business owner is active
  ],
};
