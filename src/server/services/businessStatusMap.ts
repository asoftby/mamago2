/**
 * Business Status Mapping
 * Maps legacy Business.status to canonical Business.verificationStatus
 * 
 * SINGLE SOURCE OF TRUTH: verificationStatus
 * - DRAFT: Not submitted
 * - PENDING: Under review
 * - NEEDS_INFO: Requires clarification from owner
 * - APPROVED: Verified, can publish
 * - REJECTED: Rejected, can resubmit
 */

import { BusinessVerificationStatus, BusinessStatus } from "@prisma/client";

/**
 * Map legacy status string to verification status
 */
export function mapLegacyStatusToVerificationStatus(
  status: BusinessStatus | string | null | undefined
): BusinessVerificationStatus {
  if (!status) return "DRAFT";

  switch (status) {
    case "PENDING_VERIFICATION":
    case "PENDING_REVIEW":
      return "PENDING";
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "DRAFT":
    default:
      return "DRAFT";
  }
}

/**
 * Get effective verification status from business object
 * Prefers verificationStatus, falls back to mapping legacy status
 */
export function getEffectiveVerificationStatus(business: {
  verificationStatus?: BusinessVerificationStatus | null;
  status?: BusinessStatus | string | null;
}): BusinessVerificationStatus {
  // If verificationStatus is set and valid, use it
  if (business.verificationStatus) {
    const validStatuses: BusinessVerificationStatus[] = [
      "DRAFT",
      "PENDING",
      "NEEDS_INFO",
      "APPROVED",
      "REJECTED",
    ];
    if (validStatuses.includes(business.verificationStatus)) {
      return business.verificationStatus;
    }
  }

  // Fall back to mapping legacy status
  return mapLegacyStatusToVerificationStatus(business.status);
}
