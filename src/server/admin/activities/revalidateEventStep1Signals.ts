import { revalidateTag } from "next/cache";
import { eventStep1SignalCacheTags } from "./eventStep1CacheTags";

/**
 * Admin mutations must provide read-after-write behavior to newly opened event forms.
 * "max" is stale-while-revalidate, so use immediate expiry for these small taxonomies.
 */
export function revalidateEventStep1Signals(...slugs: Array<string | null | undefined>): void {
  for (const tag of eventStep1SignalCacheTags(...slugs)) {
    revalidateTag(tag, { expire: 0 });
  }
}
