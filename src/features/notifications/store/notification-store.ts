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

/** Timestamps of last successful fetch per stream (for throttling). */
let lastUserUnreadFetchAt = 0;
let lastBusinessUnreadFetchAt = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bumpRevision(set: (partial: Partial<NotificationState>) => void) {
  set({ revision: Date.now() });
}

const initialSnapshot = (): NotificationState => ({
  authenticated: false,
  unreadCount: 0,
  businessUnreadCount: 0,
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
  setAuthenticated: (authenticated: boolean) => void;
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
        const markData = await postMarkNotificationsOpenApi();
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
        set((s) => ({
          inflight: { ...s.inflight, markOpen: false },
        }));
      }
    };

    return {
      ...initialSnapshot(),

      setAuthenticated: (authenticated) => set({ authenticated }),

      reset: () => {
        // Also reset throttle timestamps so the next auth cycle fetches fresh.
        lastUserUnreadFetchAt = 0;
        lastBusinessUnreadFetchAt = 0;
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
        const p = (async () => {
          set((s) => ({
            inflight: { ...s.inflight, fetchUnread: true },
          }));
          try {
            const unified = await fetchUnreadCountFromApi();
            if (!get().authenticated) return;
            lastUserUnreadFetchAt = Date.now();
            set({ unreadCount: unified });
            bumpRevision(set);
          } finally {
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
        const p = (async () => {
          set((s) => ({
            inflight: { ...s.inflight, fetchUnread: true },
          }));
          try {
            const business = await fetchUnreadCountFromApi("business");
            if (!get().authenticated) return;
            lastBusinessUnreadFetchAt = Date.now();
            set({ businessUnreadCount: business });
            bumpRevision(set);
          } finally {
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
        if (!get().authenticated) return;
        if (get().inflight.fetchList) return;
        if (get().isHydrated && !force) return;

        set((s) => ({
          inflight: { ...s.inflight, fetchList: true },
          error: null,
        }));
        try {
          const page = await fetchNotificationsPageApi(0, PAGE_SIZE);
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
          set((s) => ({
            inflight: { ...s.inflight, fetchList: false },
          }));
        }
      },

      fetchMoreNotifications: async () => {
        if (!get().authenticated) return;
        if (!get().hasMore || get().inflight.fetchList || get().loadingMore) return;

        set({ loadingMore: true });
        set((s) => ({
          inflight: { ...s.inflight, fetchList: true },
        }));
        try {
          const start = get().offset;
          const page = await fetchNotificationsPageApi(start, PAGE_SIZE);
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
          set({ loadingMore: false });
          set((s) => ({
            inflight: { ...s.inflight, fetchList: false },
          }));
        }
      },

      openPanel: async () => {
        if (!get().authenticated) return;
        set({ panelOpen: true });
        if (get().isHydrated) return;

        set({ isLoading: true, error: null });
        try {
          await get().fetchNotifications({ force: true });
          await maybeMarkOpen();
        } finally {
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
