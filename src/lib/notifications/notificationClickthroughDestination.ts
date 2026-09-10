import { getSafeRedirectPath } from "@/lib/auth/redirectTo";
import {
  buildSurfaceRedirectDestination,
  normalizeTargetPathForSurface,
  surfaceFromPathname,
} from "@/lib/routing/surface";

function pathnameFromDestination(destination: string): string {
  const boundary = destination.search(/[?#]/u);
  return boundary === -1 ? destination : destination.slice(0, boundary);
}

function normalizeProtocol(protocol: string | null | undefined): string | undefined {
  if (!protocol) return undefined;
  return protocol.replace(/:$/u, "");
}

/**
 * Resolve a notification click-through destination onto its canonical app
 * surface. This matters when /n/[id] is opened from admin.* or business.*:
 * public /me/* destinations must leave that subdomain, while /admin/* and
 * /business/* destinations must move to their corresponding surface hosts.
 */
export function resolveNotificationClickthroughDestination(params: {
  destination: string | null | undefined;
  currentHost?: string | null;
  currentProtocol?: string | null;
}): string | null {
  const safeInternalDestination = getSafeRedirectPath(params.destination, "");

  if (safeInternalDestination) {
    const targetSurface = surfaceFromPathname(
      pathnameFromDestination(safeInternalDestination),
    );
    const targetPath = normalizeTargetPathForSurface(
      targetSurface,
      safeInternalDestination,
    );

    return buildSurfaceRedirectDestination({
      targetSurface,
      targetPath,
      currentHost: params.currentHost,
      currentProtocol: normalizeProtocol(params.currentProtocol),
    });
  }

  if (params.destination && /^https?:\/\//iu.test(params.destination)) {
    return params.destination;
  }

  return null;
}
