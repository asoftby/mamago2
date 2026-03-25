import type { Role } from "@prisma/client";

/**
 * Get the appropriate profile destination URL based on user role and business status
 * 
 * @param params - Configuration object
 * @param params.host - Current request host (e.g., "localhost:3000", "mamago.by")
 * @param params.role - User role from session
 * @param params.businessStatus - Business verification status (optional)
 * @returns Absolute or relative URL for profile destination
 */
export function getProfileDestination(params: {
  host: string;
  role: Role;
  businessStatus?: "DRAFT" | "PENDING" | "REJECTED" | "APPROVED" | "NEEDS_INFO" | null;
}): string {
  void params.host;
  void params.role;
  void params.businessStatus;
  /** Единая точка входа в личный кабинет — без редиректов по роли. */
  return "/me";
}
