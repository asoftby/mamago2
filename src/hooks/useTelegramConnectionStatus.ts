import { useCallback, useEffect, useRef, useState } from "react";

export type TelegramConnectionStatus = {
  linked: boolean;
  configured?: boolean;
  username?: string;
  botUsername?: string;
  environment?: "DEV" | "PROD";
  telegramUserId?: string;
  linkedAt?: string;
};

export type UseTelegramConnectionStatusOptions = {
  /** Enable initial fetch and status tracking */
  enabled?: boolean;
  /** Enable polling (only works when enabled=true) */
  polling?: boolean;
  /** Polling interval in milliseconds */
  intervalMs?: number;
  /** Maximum polling duration in milliseconds */
  timeoutMs?: number;
  /** Callback when connection is established */
  onConnected?: (status: TelegramConnectionStatus) => void;
  /** Callback when polling times out without connection */
  onTimeout?: () => void;
};

const DEFAULT_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Unified hook for Telegram connection status management.
 *
 * Features:
 * - Single initial fetch when enabled
 * - Controlled polling with timeout
 * - Automatic cleanup on unmount
 * - Stops polling when connected
 * - Reports timeout so parent can reset UI
 *
 * @example
 * // Simple status check (no polling)
 * const { status, loading } = useTelegramConnectionStatus({ enabled: true });
 *
 * @example
 * // With polling after user clicks "Connect"
 * const { status, startPolling, stopPolling, timedOut } = useTelegramConnectionStatus({
 *   enabled: true,
 *   onConnected: () => toast.success("Connected!"),
 *   onTimeout: () => setIsPolling(false),
 * });
 * // Later: startPolling() when user opens bot
 */
export function useTelegramConnectionStatus(
  options: UseTelegramConnectionStatusOptions = {}
) {
  const {
    enabled = false,
    polling = false,
    intervalMs = DEFAULT_INTERVAL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onConnected,
    onTimeout,
  } = options;

  const [status, setStatus] = useState<TelegramConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const hasCalledOnConnectedRef = useRef(false);
  const hasCalledOnTimeoutRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/telegram/status", {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch status");
      }

      const data = (await res.json()) as TelegramConnectionStatus;

      if (!mountedRef.current) return null;

      setStatus(data);
      setError(null);
      setTimedOut(false);
      return data;
    } catch (err) {
      if (!mountedRef.current) return null;

      const message =
        err instanceof Error ? err.message : "Failed to fetch status";
      setError(message);
      return null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollStartRef.current = Date.now();
    hasCalledOnConnectedRef.current = false;
    hasCalledOnTimeoutRef.current = false;
    setTimedOut(false);

    pollTimerRef.current = setInterval(async () => {
      // Check timeout
      if (Date.now() - pollStartRef.current > timeoutMs) {
        stopPolling();
        if (!hasCalledOnTimeoutRef.current && mountedRef.current) {
          hasCalledOnTimeoutRef.current = true;
          setTimedOut(true);
          onTimeout?.();
        }
        return;
      }

      const data = await fetchStatus();

      // Stop polling if connected
      if (data?.linked) {
        stopPolling();
        if (!hasCalledOnConnectedRef.current && onConnected) {
          hasCalledOnConnectedRef.current = true;
          onConnected(data);
        }
      }
    }, intervalMs);
  }, [stopPolling, fetchStatus, intervalMs, timeoutMs, onConnected, onTimeout]);

  // Initial fetch when enabled
  useEffect(() => {
    if (!enabled) return;

    setLoading(true);
    void fetchStatus().finally(() => {
      if (mountedRef.current) {
        setLoading(false);
      }
    });
  }, [enabled, fetchStatus]);

  // Controlled polling
  useEffect(() => {
    if (!enabled || !polling) {
      stopPolling();
      return;
    }

    // Don't start polling if already connected
    if (status?.linked) {
      return;
    }

    startPolling();

    return () => {
      stopPolling();
    };
  }, [enabled, polling, status?.linked, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  const resetTimeout = useCallback(() => {
    setTimedOut(false);
    hasCalledOnTimeoutRef.current = false;
  }, []);

  return {
    status,
    loading,
    error,
    timedOut,
    isConnected: status?.linked ?? false,
    startPolling,
    stopPolling,
    refetch: fetchStatus,
    resetTimeout,
  };
}
