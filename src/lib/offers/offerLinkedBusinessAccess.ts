import type { Role } from "@prisma/client";

export type OfferCreationOrPublishStatus = "DRAFT" | "PENDING" | "PUBLISHED" | null | undefined;

export function canBypassOfferBusinessPlaceRestriction(role: Role): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}

export function shouldRequireLinkedBusinessPlaceForOfferStatus(params: {
  role: Role;
  status: OfferCreationOrPublishStatus;
}): boolean {
  if (canBypassOfferBusinessPlaceRestriction(params.role)) {
    return false;
  }

  return params.role === "BUSINESS_OWNER" && params.status != null && params.status !== "DRAFT";
}

export function shouldRejectUnlinkedPlaceForOfferMutation(params: {
  role: Role;
  status: OfferCreationOrPublishStatus;
  ownerBusinessId: string | null | undefined;
}): boolean {
  return (
    !params.ownerBusinessId &&
    shouldRequireLinkedBusinessPlaceForOfferStatus({
      role: params.role,
      status: params.status,
    })
  );
}
