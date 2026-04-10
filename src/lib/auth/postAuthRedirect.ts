import { buildClientSurfaceDestination } from "@/lib/routing/clientNavigation";

/**
 * Unified post-authentication redirect helper
 *
 * After successful login or registration (when no explicit `next` is provided),
 * regular users land on /me.
 */

/**
 * Get the post-authentication redirect URL
 */
export function getPostAuthRedirect(): string {
  if (typeof window === "undefined") {
    return "/me";
  }

  const protocol = window.location.protocol.replace(/:$/u, "");
  const host = window.location.host;

  return buildClientSurfaceDestination({
    targetSurface: "public",
    targetPath: "/me",
    currentHost: host,
    currentProtocol: protocol,
  });
}
