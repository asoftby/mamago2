/**
 * Business Verification Guard
 * SINGLE SOURCE OF TRUTH for business verification gating logic
 * Server-only - do not import in client components
 * 
 * CANONICAL STATUS: Business.verificationStatus (BusinessVerificationStatus enum)
 * - DRAFT: Not submitted, can edit
 * - PENDING: Under review, read-only
 * - APPROVED: Verified, full access
 * - REJECTED: Rejected, can view reason and resubmit
 */

import { BusinessVerificationStatus } from "@prisma/client";

/**
 * Enforce business access control based on verification status
 * Returns null if access is allowed, or redirect path if should redirect
 * 
 * ROUTING RULES:
 * - DRAFT: Only /business/onboarding allowed
 * - PENDING: Only /business/verification allowed (read-only)
 * - REJECTED: Both /business/verification and /business/onboarding allowed
 * - APPROVED: /business/dashboard and all cabinet routes allowed
 */
export function enforceBusinessAccess(
  requestedPath: string,
  status: BusinessVerificationStatus
): string | null {
  // Normalize path (remove query params and trailing slash)
  const normalizedPath = requestedPath.split("?")[0].replace(/\/$/, "");

  // Define route categories
  const isOnboarding = normalizedPath.startsWith("/business/onboarding");
  const isVerification = normalizedPath.startsWith("/business/verification");
  const isDashboard = normalizedPath.startsWith("/business/dashboard");
  const isPending = normalizedPath === "/business/pending"; // Legacy redirect route
  const isCabinetRoute = normalizedPath.startsWith("/business/") && 
                         !isOnboarding && 
                         !isVerification &&
                         !isDashboard &&
                         !isPending &&
                         normalizedPath !== "/business";

  // DRAFT: Only allow onboarding
  if (status === "DRAFT") {
    if (isOnboarding) return null; // Allow editing
    return "/business/onboarding"; // Redirect to onboarding
  }

  // PENDING: Only allow verification page (read-only status)
  if (status === "PENDING") {
    if (isVerification || isPending) return null; // Allow viewing status
    return "/business/verification"; // Redirect to verification (blocks editing)
  }

  // REJECTED: Allow verification (to see reason) and onboarding (to fix)
  if (status === "REJECTED") {
    if (isVerification || isOnboarding || isPending) return null; // Allow both
    return "/business/verification"; // Default to verification (shows rejection reason)
  }

  // APPROVED: Allow dashboard and all cabinet routes
  if (status === "APPROVED") {
    if (isDashboard || isCabinetRoute) return null; // Allow full access
    if (isOnboarding || isVerification) return "/business/dashboard"; // Redirect to dashboard
    return null; // Allow other routes
  }

  // Fallback: redirect to onboarding for unknown statuses
  return "/business/onboarding";
}

/**
 * Check if a route requires verification
 * Used to determine if guard should be applied
 */
export function requiresVerificationCheck(path: string): boolean {
  return path.startsWith("/business/") && path !== "/business";
}

/**
 * Get user-friendly status label
 */
export function getStatusLabel(status: BusinessVerificationStatus): string {
  switch (status) {
    case "DRAFT":
      return "Черновик";
    case "PENDING":
      return "На проверке";
    case "APPROVED":
      return "Одобрено";
    case "REJECTED":
      return "Отклонено";
    default:
      return status;
  }
}
