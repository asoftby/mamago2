"use client";

import { createContext, useContext, useCallback, useState, useRef, ReactNode } from "react";
import type { NotificationApiRow } from "@/lib/notifications/types";

export type NotificationCacheState = {
  notifications: NotificationApiRow[];
  hasMore: boolean;
  offset: number;
  total: number;
  showTelegramPrompt: boolean;
  lastFetchedAt: number | null;
  isLoading: boolean;
  error: Error | null;
};

export type NotificationCacheContextType = {
  cache: NotificationCacheState;
  setCacheNotifications: (notifications: NotificationApiRow[], hasMore: boolean, total: number, offset: number) => void;
  setCacheLoading: (loading: boolean) => void;
  setCacheError: (error: Error | null) => void;
  setShowTelegramPrompt: (show: boolean) => void;
  updateNotificationsSeen: (ids: string[]) => void;
  clearCache: () => void;
  isCacheValid: (maxAgeMs: number) => boolean;
};

const NotificationCacheContext = createContext<NotificationCacheContextType | undefined>(undefined);

const INITIAL_STATE: NotificationCacheState = {
  notifications: [],
  hasMore: false,
  offset: 0,
  total: 0,
  showTelegramPrompt: false,
  lastFetchedAt: null,
  isLoading: false,
  error: null,
};

export function NotificationCacheProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<NotificationCacheState>(INITIAL_STATE);
  const markOpenInFlightRef = useRef(false);
  const lastMarkOpenAtRef = useRef<number | null>(null);

  const setCacheNotifications = useCallback(
    (notifications: NotificationApiRow[], hasMore: boolean, total: number, offset: number) => {
      setCache((prev) => ({
        ...prev,
        notifications,
        hasMore,
        total,
        offset,
        lastFetchedAt: Date.now(),
        isLoading: false,
        error: null,
      }));
    },
    []
  );

  const setCacheLoading = useCallback((loading: boolean) => {
    setCache((prev) => ({
      ...prev,
      isLoading: loading,
    }));
  }, []);

  const setCacheError = useCallback((error: Error | null) => {
    setCache((prev) => ({
      ...prev,
      error,
      isLoading: false,
    }));
  }, []);

  const setShowTelegramPrompt = useCallback((show: boolean) => {
    setCache((prev) => ({
      ...prev,
      showTelegramPrompt: show,
    }));
  }, []);

  const updateNotificationsSeen = useCallback((ids: string[]) => {
    setCache((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        ids.includes(n.id)
          ? { ...n, seenAt: n.seenAt ?? new Date().toISOString() }
          : n
      ),
    }));
  }, []);

  const clearCache = useCallback(() => {
    setCache(INITIAL_STATE);
    markOpenInFlightRef.current = false;
    lastMarkOpenAtRef.current = null;
  }, []);

  const isCacheValid = useCallback((maxAgeMs: number) => {
    if (!cache.lastFetchedAt) return false;
    return Date.now() - cache.lastFetchedAt < maxAgeMs;
  }, [cache.lastFetchedAt]);

  const value: NotificationCacheContextType = {
    cache,
    setCacheNotifications,
    setCacheLoading,
    setCacheError,
    setShowTelegramPrompt,
    updateNotificationsSeen,
    clearCache,
    isCacheValid,
  };

  return (
    <NotificationCacheContext.Provider value={value}>
      {children}
    </NotificationCacheContext.Provider>
  );
}

export function useNotificationCache() {
  const context = useContext(NotificationCacheContext);
  if (!context) {
    throw new Error("useNotificationCache must be used within NotificationCacheProvider");
  }
  return context;
}

export function useOptionalNotificationCache() {
  return useContext(NotificationCacheContext);
}
