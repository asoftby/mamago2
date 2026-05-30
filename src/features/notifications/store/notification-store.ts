import { create } from "zustand";
import type { NotificationState, NotificationItem } from "./notification-types";
import {
  fetchNotificationsPageApi,
  fetchUnreadCountFromApi,
  postMarkNotificationsOpenApi,
} from "./notification-actions";
import { isBusinessSurface } from "./notification-surface";

const PAGE_SIZE = 15;

/** Minimum ms between successive unread-count fetches for the same stream. */
const THROTTLE_MS = 10_000;

// ─── Dev logging ─────────────────────────────────────────────────────────────

function devLog(msg: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[notifications] ${msg}`, ...args);
  }
}

// ─── In-flight deduplication ─────────────────────────────────────────────────

/** In-flight dedupe: concurrent callers await the same network work. */
let unifiedUnreadPromise: Promise<void> | null = null;
let businessUnreadPromise: Promise<void> | null = null;
let bothUnreadChainPromise: Promise<void> | null = null;
let authContextKey: string | null = null;
let authEpoch = 0;

/** Timestamps of last successful fetch per stream (for throttling). */
let lastUserUnreadFetchAt = 0;
let lastBusinessUnreadFetchAt = 0;

/**
 * Reset module-level state. Called on logout and auth change.
 * Prevents stale state when switching between accounts.
 */
function resetModuleLevelState(nextAuthContextKey: string | null = null): void {
  unifiedUnreadPromise = null;
  businessUnreadPromise = null;
  bothUnreadChainPromise = null;
  lastUserUnreadFetchAt = 0;
  lastBusinessUnreadFetchAt = 0;
  authContextKey = nextAuthContextKey;
  authEpoch += 1;
}

function isStaleAuthEpoch(epoch: number): boolean {
  return epoch !== authEpoch;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bumpRevision(set: (partial: Partial<NotificationState>) => void) {
  set({ revision: Date.now() });
}

const initialSnapshot = (): NotificationState => ({
  authenticated: false,
  unreadCount: 0,
  businessUnreadCount: 0,
  activeStream: "user",
  items: [],
  isLoading: false,
  loadingMore: false,
  isHydrated: false,
  hasMore: false,
  offset: 0,
  lastFetchedAt: undefined,
  lastSeenAt: null,
  error: null,
  showTelegramPrompt: false,
  panelOpen: false,
  lastMarkOpenAt: null,
  inflight: {},
  revision: 0,
});

// ─── Store actions type ───────────────────────────────────────────────────────

export type NotificationStoreActions = {
  setAuthenticated: (authenticated: boolean, userId?: string | null) => void;
  setActiveStream: (stream: "user" | "business") => void;
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: (options?: { force?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
  refreshUnreadOnly: (options?: { force?: boolean }) => Promise<void>;
  refreshBusinessUnreadOnly: (options?: { force?: boolean }) => Promise<void>;
  refreshBothUnreadCounts: (options?: { force?: boolean }) => Promise<void>;
  openPanel: () => Promise<void>;
  closePanel: () => void;
  clearError: () => void;
  markAllRead: () => Promise<void>;
  markAsRead: (id: string) => void;
  appendNotification: (notification: NotificationItem) => void;
  removeNotification: (id: string) => void;
  reset: () => void;
  fetchMoreNotifications: () => Promise<void>;
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationState & NotificationStoreActions>(
  (set, get) => {
    const maybeMarkOpen = async () => {
      const requestEpoch = authEpoch;
      const state = get();
      if (!state.authenticated || state.inflight.markOpen) return;

      const hasUnreadItems = state.items.some((n) => !n.seenAt);
      const hasUnreadCount =
        state.unreadCount > 0 || state.businessUnreadCount > 0;
      const now = Date.now();
      const last = state.lastMarkOpenAt;

      if (
        !hasUnreadItems &&
        last !== null &&
        now - last < 5 * 60 * 1000
      ) {
        return;
      }

      if (!hasUnreadItems && !hasUnreadCount) {
        return;
      }

      set((s) => ({
        inflight: { ...s.inflight, markOpen: true },
      }));
      try {
        const markData = await postMarkNotificationsOpenApi(state.activeStream);
        if (isStaleAuthEpoch(requestEpoch)) return;
        if (typeof markData.showTelegramPrompt === "boolean") {
          set({ showTelegramPrompt: markData.showTelegramPrompt });
        }
        const ts = new Date().toISOString();
        set((s) => ({
          items: s.items.map((n) => ({
            ...n,
            seenAt: n.seenAt ?? ts,
            isRead: true,
          })),
          lastMarkOpenAt: Date.now(),
          lastSeenAt: ts,
        }));
        // After marking open, only refresh the relevant stream.
        if (isBusinessSurface()) {
          await get().refreshBusinessUnreadOnly({ force: true });
        } else {
          await get().refreshUnreadOnly({ force: true });
        }
      } catch (error) {
        console.error("Failed to mark notifications as open:", error);
      } finally {
        if (isStaleAuthEpoch(requestEpoch)) return;
        set((s) => ({
          inflight: { ...s.inflight, markOpen: false },
        }));
      }
    };

    return {
      ...initialSnapshot(),

      setAuthenticated: (authenticated, userId) => {
        const current = get().authenticated;
        const nextAuthContextKey =
          authenticated ? userId ?? "__authenticated__" : null;
        if (
          current !== authenticated ||
          authContextKey !== nextAuthContextKey
        ) {
          // Reset everything when switching auth state or account to prevent data leaks.
          resetModuleLevelState(nextAuthContextKey);
          set({ ...initialSnapshot(), authenticated });
        }
      },

      setActiveStream: (stream) => {
        if (get().activeStream === stream) return;
        set((state) => ({
          activeStream: stream,
          items: [],
          isHydrated: false,
          hasMore: false,
          offset: 0,
          panelOpen: state.panelOpen,
          error: null,
        }));
      },

      reset: () => {
        // Reset module-level state on explicit reset
        resetModuleLevelState(null);
        set(initialSnapshot());
      },

      fetchUnreadCount: async () => {
        await get().refreshUnreadOnly();
      },

      refreshUnreadOnly: async (options) => {
        const force = options?.force === true;

        if (!get().authenticated) {
          devLog("refreshUnreadOnly: skipped — unauthenticated");
          return;
        }

        // Throttle: skip if fetched recently and not forced.
        const now = Date.now();
        if (!force && now - lastUserUnreadFetchAt < THROTTLE_MS) {
          devLog("refreshUnreadOnly: skipped — throttled (%dms ago)", now - lastUserUnreadFetchAt);
          return;
        }

        // In-flight dedup: return existing promise if one is running.
        if (unifiedUnreadPromise) {
          devLog("refreshUnreadOnly: skipped — in-flight");
          return unifiedUnreadPromise;
        }

        devLog("refreshUnreadOnly: fetching user unread-count");
        const requestEpoch = authEpoch;
        const p = (async () => {
          set((s) => ({
            inflight: { ...s.inflight, fetchUnread: true },
          }));
          try {
            const unified = await fetchUnreadCountFromApi();
            if (!get().authenticated || isStaleAuthEpoch(requestEpoch)) return;
            lastUserUnreadFetchAt = Date.now();
            set({ unreadCount: unified });
            bumpRevision(set);
          } finally {
            if (isStaleAuthEpoch(requestEpoch)) return;
            set((s) => ({
              inflight: { ...s.inflight, fetchUnread: false },
            }));
          }
        })();

        unifiedUnreadPromise = p;
        void p.finally(() => {
          if (unifiedUnreadPromise === p) unifiedUnreadPromise = null;
        });
        return p;
      },

      refreshBusinessUnreadOnly: async (options) => {
        const force = options?.force === true;

        if (!get().authenticated) {
          devLog("refreshBusinessUnreadOnly: skipped — unauthenticated");
          return;
        }

        // Guard: only fetch business unread on business surface (unless forced).
        if (!force && !isBusinessSurface()) {
          devLog("refreshBusinessUnreadOnly: skipped — public surface");
          return;
        }

        // Throttle: skip if fetched recently and not forced.
        const now = Date.now();
        if (!force && now - lastBusinessUnreadFetchAt < THROTTLE_MS) {
          devLog(
            "refreshBusinessUnreadOnly: skipped — throttled (%dms ago)",
            now - lastBusinessUnreadFetchAt,
          );
          return;
        }

        // In-flight dedup.
        if (businessUnreadPromise) {
          devLog("refreshBusinessUnreadOnly: skipped — in-flight");
          return businessUnreadPromise;
        }

        devLog("refreshBusinessUnreadOnly: fetching business unread-count");
        const requestEpoch = authEpoch;
        const p = (async () => {
          set((s) => ({
            inflight: { ...s.inflight, fetchUnread: true },
          }));
          try {
            const business = await fetchUnreadCountFromApi("business");
            if (!get().authenticated || isStaleAuthEpoch(requestEpoch)) return;
            lastBusinessUnreadFetchAt = Date.now();
            set({ businessUnreadCount: business });
            bumpRevision(set);
          } finally {
            if (isStaleAuthEpoch(requestEpoch)) return;
            set((s) => ({
              inflight: { ...s.inflight, fetchUnread: false },
            }));
          }
        })();

        businessUnreadPromise = p;
        void p.finally(() => {
          if (businessUnreadPromise === p) businessUnreadPromise = null;
        });
        return p;
      },

      refreshBothUnreadCounts: async (options) => {
        const force = options?.force === true;

        if (!get().authenticated) {
          devLog("refreshBothUnreadCounts: skipped — unauthenticated");
          return;
        }

        // On public surface, only refresh user unread.
        if (!force && !isBusinessSurface()) {
          devLog("refreshBothUnreadCounts: public surface → refreshUnreadOnly only");
          return get().refreshUnreadOnly(options);
        }

        if (bothUnreadChainPromise) {
          devLog("refreshBothUnreadCounts: skipped — in-flight");
          return bothUnreadChainPromise;
        }

        devLog("refreshBothUnreadCounts: fetching user + business");
        const p = (async () => {
          await get().refreshUnreadOnly(options);
          await get().refreshBusinessUnreadOnly(options);
        })();

        bothUnreadChainPromise = p;
        void p.finally(() => {
          if (bothUnreadChainPromise === p) bothUnreadChainPromise = null;
        });
        return p;
      },

      refresh: async () => {
        if (!get().authenticated) return;
        await get().refreshBothUnreadCounts();
        if (get().isHydrated) {
          await get().fetchNotifications({ force: true });
        }
        bumpRevision(set);
      },

      fetchNotifications: async (options) => {
        const force = options?.force === true;
        const requestEpoch = authEpoch;
        if (!get().authenticated) return;
        if (get().inflight.fetchList) return;
        if (get().isHydrated && !force) return;

        set((s) => ({
          inflight: { ...s.inflight, fetchList: true },
          error: null,
        }));
        try {
          const page = await fetchNotificationsPageApi(0, PAGE_SIZE, get().activeStream);
          if (!get().authenticated || isStaleAuthEpoch(requestEpoch)) return;
          set({
            items: page.notifications,
            hasMore: page.hasMore,
            offset: page.notifications.length,
            isHydrated: true,
            lastFetchedAt: Date.now(),
            showTelegramPrompt:
              typeof page.showTelegramPrompt === "boolean"
                ? page.showTelegramPrompt
                : get().showTelegramPrompt,
          });
          bumpRevision(set);
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "Не удалось загрузить уведомления";
          set({ error: message });
          throw e;
        } finally {
          if (isStaleAuthEpoch(requestEpoch)) return;
          set((s) => ({
            inflight: { ...s.inflight, fetchList: false },
          }));
        }
      },

      fetchMoreNotifications: async () => {
        const requestEpoch = authEpoch;
        if (!get().authenticated) return;
        if (!get().hasMore || get().inflight.fetchList || get().loadingMore) return;

        set({ loadingMore: true });
        set((s) => ({
          inflight: { ...s.inflight, fetchList: true },
        }));
        try {
          const start = get().offset;
          const page = await fetchNotificationsPageApi(start, PAGE_SIZE, get().activeStream);
          if (!get().authenticated || isStaleAuthEpoch(requestEpoch)) return;
          set((s) => ({
            items: [...s.items, ...page.notifications],
            hasMore: page.hasMore,
            offset: start + page.notifications.length,
          }));
          bumpRevision(set);
        } catch (e) {
          console.error(e);
          throw e;
        } finally {
          if (isStaleAuthEpoch(requestEpoch)) return;
          set({ loadingMore: false });
          set((s) => ({
            inflight: { ...s.inflight, fetchList: false },
          }));
        }
      },

      openPanel: async () => {
        const requestEpoch = authEpoch;
        if (!get().authenticated) return;
        set({ panelOpen: true });
        if (get().isHydrated) return;

        set({ isLoading: true, error: null });
        try {
          await get().fetchNotifications({ force: true });
          await maybeMarkOpen();
        } finally {
          if (isStaleAuthEpoch(requestEpoch)) return;
          set({ isLoading: false });
        }
      },

      closePanel: () => set({ panelOpen: false }),

      clearError: () => set({ error: null }),

      markAllRead: async () => {
        await maybeMarkOpen();
      },

      markAsRead: (id) => {
        const ts = new Date().toISOString();
        set((s) => ({
          items: s.items.map((n) =>
            n.id === id ? { ...n, seenAt: n.seenAt ?? ts, isRead: true } : n,
          ),
        }));
      },

      appendNotification: (notification) => {
        set((s) => ({
          items: [notification, ...s.items],
        }));
      },

      removeNotification: (id) => {
        set((s) => ({
          items: s.items.filter((n) => n.id !== id),
        }));
      },
    };
  },
);
