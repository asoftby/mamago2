import type { RenderPolicy, ResolvedSlot } from "./types";
import { DEFAULT_RENDER_POLICY } from "./types";

export { DEFAULT_RENDER_POLICY };

/**
 * Rail-side gate: hide the whole rail below `minSlotsToRender`,
 * then cap at `maxSlots`.
 */
export function applyRenderPolicy(
  slots: ResolvedSlot[],
  policy: RenderPolicy = DEFAULT_RENDER_POLICY,
): ResolvedSlot[] {
  if (slots.length < policy.minSlotsToRender) return [];
  return slots.slice(0, policy.maxSlots);
}
