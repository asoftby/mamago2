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
  const { host, role, businessStatus } = params;

  // Regular users go to /me
  if (role !== "BUSINESS_OWNER") {
    return "/me";
  }

  // Business owners go to business subdomain
  const businessPath = businessStatus === "APPROVED" 
    ? "/dashboard" 
    : businessStatus === "DRAFT"
    ? "/onboarding"
    : "/verification";

  return businessSubdomainUrl(host, businessPath);
}

/**
 * Build business subdomain URL preserving environment
 * 
 * @param host - Current request host
 * @param path - Path on business subdomain
 * @returns Full URL with business subdomain
 */
function businessSubdomainUrl(host: string, path: string): string {
  // Normalize path
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Check if localhost
  if (host.includes("localhost")) {
    // Extract port if present
    const portMatch = host.match(/:(\d+)/);
    const port = portMatch ? `:${portMatch[1]}` : ":3000";
    return `http://business.localhost${port}${normalizedPath}`;
  }

  // Production - use business subdomain
  // Extract base domain (handle both "mamago.by" and "www.mamago.by")
  const baseDomain = host.replace(/^(www\.|business\.|admin\.)/, "");
  return `https://business.${baseDomain}${normalizedPath}`;
}
