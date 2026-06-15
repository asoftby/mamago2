import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildAuthUrl, getSafeRedirectPath } from "@/lib/auth/redirectTo";
import {
  buildSurfaceRedirectDestination,
  normalizeTargetPathForSurface,
  surfaceFromPathname,
  type AppSurface,
} from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

export const REQUEST_PATHNAME_HEADER = "x-mamago-pathname";
export const REQUEST_SEARCH_HEADER = "x-mamago-search";

/**
 * Current request path (pathname + search) injected by middleware.
 */
export async function getRequestCurrentPath(): Promise<string> {
  const headerStore = await headers();
  const pathname = headerStore.get(REQUEST_PATHNAME_HEADER) ?? "/";
  const search = headerStore.get(REQUEST_SEARCH_HEADER) ?? "";
  return `${pathname}${search}`;
}

export interface RequireAuthLoginOptions {
  mode?: "login" | "register";
  extra?: Record<string, string | undefined>;
  /** Override auto-detected current path. */
  redirectTo?: string;
}

/**
 * Absolute or surface-aware login URL with redirectTo for the current page.
 */
export async function buildRequireAuthLoginDestination(
  options: RequireAuthLoginOptions = {},
): Promise<string> {
  const routing = await getCurrentRequestRoutingContext();
  const currentPath = options.redirectTo ?? (await getRequestCurrentPath());
  const authPath = buildAuthUrl({
    mode: options.mode,
    redirectTo: currentPath,
    extra: options.extra,
  });

  return buildSurfaceRedirectDestination({
    targetSurface: "public",
    targetPath: authPath,
    ...routing,
  });
}

/** Server redirect to login preserving current page as redirectTo. */
export async function redirectToLogin(options: RequireAuthLoginOptions = {}): Promise<never> {
  redirect(await buildRequireAuthLoginDestination(options));
}

/** Resolve post-login destination for an already authenticated user on the login page. */
export async function buildAuthenticatedAuthRedirectDestination(
  redirectParam: string | undefined,
  options?: {
    fromAdmin?: boolean;
    isAdminRole?: boolean;
    fallbackPath?: string;
  },
): Promise<string> {
  const routing = await getCurrentRequestRoutingContext();
  const fallback = options?.fallbackPath ?? "/me";
  const targetPath = getSafeRedirectPath(redirectParam, "");

  if (targetPath) {
    const targetSurface = surfaceFromPathname(targetPath);
    return buildSurfaceRedirectDestination({
      targetSurface,
      targetPath: normalizeTargetPathForSurface(targetSurface, targetPath),
      ...routing,
    });
  }

  if (options?.fromAdmin && options?.isAdminRole) {
    return buildSurfaceRedirectDestination({
      targetSurface: "admin" as AppSurface,
      targetPath: "/",
      ...routing,
    });
  }

  return buildSurfaceRedirectDestination({
    targetSurface: "public",
    targetPath: fallback,
    ...routing,
  });
}
