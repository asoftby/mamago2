import { create } from "zustand";
import type { NotificationState, NotificationItem } from "./notification-types";
import {
  fetchNotificationsPageApi,
  fetchUnreadCountFromApi,
  postMarkNotificationsOpenApi,
} from "./notification-actions";

const PAGE_SIZE = 15;

/** In-flight dedupe: concurrent callers await the same network work. */
let unifiedUnreadPromise: Promise<void> | null = null;
let businessUnreadPromise: Promise<void> | null = null;
let bothUnreadChainPromise: Promise<void> | null = null;

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

export type NotificationStoreActions = {
  setAuthenticated: (authenticated: boolean) => void;
  fetchUnreadCount: () => Promise<void>;
  fetchNotifications: (options?: { force?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
  refreshUnreadOnly: () => Promise<void>;
  refreshBusinessUnreadOnly: () => Promise<void>;
  refreshBothUnreadCounts: () => Promise<void>;
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
        await get().refreshBothUnreadCounts();
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

      reset: () => set(initialSnapshot()),

      fetchUnreadCount: async () => {
        await get().refreshUnreadOnly();
      },

      refreshUnreadOnly: async () => {
        if (!get().authenticated) return;
        if (unifiedUnreadPromise) return unifiedUnreadPromise;

        const p = (async () => {
          set((s) => ({
            inflight: { ...s.inflight, fetchUnread: true },
          }));
          try {
            const unified = await fetchUnreadCountFromApi();
            if (!get().authenticated) return;
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

      refreshBusinessUnreadOnly: async () => {
        if (!get().authenticated) return;
        if (businessUnreadPromise) return businessUnreadPromise;

        const p = (async () => {
          set((s) => ({
            inflight: { ...s.inflight, fetchUnread: true },
          }));
          try {
            const business = await fetchUnreadCountFromApi("business");
            if (!get().authenticated) return;
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

      refreshBothUnreadCounts: async () => {
        if (!get().authenticated) return;
        if (bothUnreadChainPromise) return bothUnreadChainPromise;

        const p = (async () => {
          await get().refreshUnreadOnly();
          await get().refreshBusinessUnreadOnly();
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
