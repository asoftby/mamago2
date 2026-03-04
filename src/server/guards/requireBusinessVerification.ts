/**
 * Business Verification Guard
 * Single source of truth for business verification gating logic
 * Server-only - do not import in client components
 */

import { BusinessVerificationStatus } from "@prisma/client";

/**
 * Get the target route based on verification status
 * This is the single source of truth for status-to-route mapping
 */
export function getBusinessGateTarget(
  status: BusinessVerificationStatus
): "/business/onboarding" | "/business/verification" | "/business/dashboard" {
  switch (status) {
    case "DRAFT":
      // New business or incomplete profile
      return "/business/onboarding";
    
    case "PENDING":
      // Under review - show status page
      return "/business/verification";
    
    case "REJECTED":
      // Rejected - can view status or edit
      // Default to verification page (shows rejection reason)
      return "/business/verification";
    
    case "APPROVED":
      // Approved - full access to dashboard
      return "/business/dashboard";
    
    default:
      // Fallback to onboarding for unknown statuses
      return "/business/onboarding";
  }
}

/**
 * Determine if access should be allowed or redirected
 * Returns null if access is allowed, or redirect path if should redirect
 */
export function enforceBusinessAccess(
  requestedPath: string,
  status: BusinessVerificationStatus
): string | null {
  const targetRoute = getBusinessGateTarget(status);

  // Normalize paths for comparison
  const normalizedRequested = requestedPath.split("?")[0]; // Remove query params
  const normalizedTarget = targetRoute.split("?")[0];

  // Define route categories
  const isOnboarding = normalizedRequested.startsWith("/business/onboarding");
  const isVerification = normalizedRequested.startsWith("/business/verification");
  const isDashboard = normalizedRequested.startsWith("/business/dashboard");
  const isCabinet = normalizedRequested.startsWith("/business/") && 
                    !isOnboarding && 
                    !isVerification &&
                    normalizedRequested !== "/business";

  // DRAFT: Only allow onboarding
  if (status === "DRAFT") {
    if (isOnboarding) return null; // Allow
    return "/business/onboarding"; // Redirect to onboarding
  }

  // PENDING: Only allow verification page (read-only)
  if (status === "PENDING") {
    if (isVerification) return null; // Allow
    if (isOnboarding) return "/business/verification"; // Block editing
    return "/business/verification"; // Redirect to verification
  }

  // REJECTED: Allow verification and onboarding (for fixing)
  if (status === "REJECTED") {
    if (isVerification || isOnboarding) return null; // Allow both
    return "/business/verification"; // Redirect to verification (shows rejection reason)
  }

  // APPROVED: Allow dashboard and cabinet, redirect verification/onboarding
  if (status === "APPROVED") {
    if (isDashboard || isCabinet) return null; // Allow
    if (isOnboarding || isVerification) return "/business/dashboard"; // Redirect to dashboard
    return null; // Allow other routes
  }

  // Default: redirect to target route
  if (normalizedRequested === normalizedTarget) {
    return null; // Already on correct route
  }
  
  return targetRoute;
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
