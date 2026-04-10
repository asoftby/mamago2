import {
  type AppSurface,
  buildSurfaceRedirectDestination,
} from "./surface.ts";

type RouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

function getCurrentBrowserRoutingContext(): {
  currentHost?: string;
  currentProtocol?: string;
} {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    currentHost: window.location.host,
    currentProtocol: window.location.protocol.replace(/:$/u, ""),
  };
}

export function buildClientSurfaceDestination(params: {
  targetSurface: AppSurface;
  targetPath: string;
  currentHost?: string | null;
  currentProtocol?: string | null;
}): string {
  return buildSurfaceRedirectDestination(params);
}

export function buildCurrentBrowserSurfaceDestination(
  targetSurface: AppSurface,
  targetPath: string,
): string {
  return buildClientSurfaceDestination({
    targetSurface,
    targetPath,
    ...getCurrentBrowserRoutingContext(),
  });
}

function isAbsoluteDestination(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function navigateToSurface(
  router: RouterLike,
  params: {
    targetSurface: AppSurface;
    targetPath: string;
    replace?: boolean;
  },
): string {
  const href = buildCurrentBrowserSurfaceDestination(
    params.targetSurface,
    params.targetPath,
  );

  if (typeof window !== "undefined" && isAbsoluteDestination(href)) {
    if (params.replace) {
      window.location.replace(href);
    } else {
      window.location.assign(href);
    }
    return href;
  }

  if (params.replace) {
    router.replace(href);
  } else {
    router.push(href);
  }

  return href;
}
