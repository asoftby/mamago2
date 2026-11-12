/**
 * Small per-instance TTL cache with in-flight de-duplication. Not shared between
 * instances or restarts: "no database read within the TTL" holds per instance.
 */
export type TtlCache<T> = {
  get(key: string, load: () => Promise<T>): Promise<{ value: T; hit: boolean }>;
  size(): number;
  clear(): void;
};

export function createTtlCache<T>(options: {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}): TtlCache<T> {
  const now = options.now ?? Date.now;
  const entries = new Map<string, { value: T; expiresAt: number }>();
  const inFlight = new Map<string, Promise<T>>();

  function evict(): void {
    const t = now();
    for (const [key, entry] of entries) if (entry.expiresAt <= t) entries.delete(key);
    while (entries.size >= options.maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  }

  return {
    async get(key, load) {
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now()) return { value: hit.value, hit: true };
      const pending = inFlight.get(key);
      if (pending) return { value: await pending, hit: true };
      const promise = load().then(
        (value) => {
          evict();
          entries.set(key, { value, expiresAt: now() + options.ttlMs });
          inFlight.delete(key);
          return value;
        },
        (error) => {
          inFlight.delete(key);
          throw error;
        },
      );
      inFlight.set(key, promise);
      return { value: await promise, hit: false };
    },
    size: () => entries.size,
    clear: () => {
      entries.clear();
      inFlight.clear();
    },
  };
}
