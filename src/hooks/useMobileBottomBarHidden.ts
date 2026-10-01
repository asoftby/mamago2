"use client";

import { useHideOnScrollDirection } from "@/hooks/useHideOnScrollDirection";

/**
 * Canonical visibility state for the public mobile bottom bar.
 *
 * Any control visually attached to the bottom bar should use this hook so it
 * follows the same scroll direction thresholds and timing.
 */
export function useMobileBottomBarHidden(): boolean {
  return useHideOnScrollDirection({ threshold: 8, topOffset: 24 });
}
