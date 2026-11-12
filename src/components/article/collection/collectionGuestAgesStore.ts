/**
 * Shared guest-age selection for all independent card runs of a collection.
 * useSyncExternalStore requires a stable primitive snapshot; JSON string meets
 * this contract and makes updates visible to every mounted run.
 *
 * Persist on this device when available. If localStorage is blocked, keep the
 * last selection in one shared in-memory fallback (not component-local state).
 */
type GuestAgeStorage = {
  readRaw: () => string;
  persistRaw: (raw: string) => void;
};

export function createCollectionGuestAgesStore(storage: GuestAgeStorage) {
  let fallbackRaw: string | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot(): string {
      if (fallbackRaw !== null) return fallbackRaw;
      try {
        return storage.readRaw();
      } catch {
        return "";
      }
    },
    getServerSnapshot(): string {
      return "";
    },
    write(ages: readonly number[]) {
      const raw = ages.length ? JSON.stringify(ages) : "";
      try {
        storage.persistRaw(raw);
        fallbackRaw = null;
      } catch {
        // Storage may be denied in private browsing / embedded contexts.
        // Keep a single shared selection until persistence becomes available.
        fallbackRaw = raw;
      }
      notify();
    },
    syncExternalStorageChange() {
      // A new selection from another tab wins over any stale fallback.
      fallbackRaw = null;
      notify();
    },
  };
}

const KEY = "mamago:collection-guest-ages";

const guestAgesStore = createCollectionGuestAgesStore({
  readRaw: () => window.localStorage.getItem(KEY) ?? "",
  persistRaw: (raw) => {
    if (raw) window.localStorage.setItem(KEY, raw);
    else window.localStorage.removeItem(KEY);
  },
});

// Attach one browser storage listener, regardless of how many collection groups
// use this store. Local writes notify subscribers directly (storage events are
// only dispatched to OTHER tabs).
let subscriberCount = 0;
function onStorage(event: StorageEvent) {
  if (event.key === KEY || event.key === null) guestAgesStore.syncExternalStorageChange();
}

export function subscribeGuestAges(listener: () => void): () => void {
  if (subscriberCount++ === 0) window.addEventListener("storage", onStorage);
  const unsubscribe = guestAgesStore.subscribe(listener);
  return () => {
    unsubscribe();
    subscriberCount--;
    if (subscriberCount === 0) window.removeEventListener("storage", onStorage);
  };
}

export function readGuestAgesRaw(): string {
  return guestAgesStore.getSnapshot();
}

export function writeGuestAges(ages: readonly number[]): void {
  guestAgesStore.write(ages);
}

export function serverGuestAgesRaw(): string {
  return guestAgesStore.getServerSnapshot();
}
