"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { buildCurrentPath } from "@/lib/auth/redirectTo";

/** Current page path (pathname + search) for auth redirectTo. */
export function useCurrentPath(): string {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return useMemo(
    () => buildCurrentPath(pathname, search ? `?${search}` : ""),
    [pathname, search],
  );
}
