import { useCallback, useEffect, useRef, useState } from "react";

export type TelegramConnectionStatus = {
  linked: boolean;
  username?: string;
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
 * 
 * @example
 * // Simple status check (no polling)
 * const { status, loading } = useTelegramConnectionStatus({ enabled: true });
 * 
 * @example
 * // With polling after user clicks "Connect"
 * const { status, startPolling, stopPolling } = useTelegramConnectionStatus({
 *   enabled: true,
 *   onConnected: () => toast.success("Connected!")
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
  } = options;

  const [status, setStatus] = useState<TelegramConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const hasCalledOnConnectedRef = useRef(false);

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
      return data;
    } catch (err) {
      if (!mountedRef.current) return null;

      const message = err instanceof Error ? err.message : "Failed to fetch status";
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

    pollTimerRef.current = setInterval(async () => {
      // Check timeout
      if (Date.now() - pollStartRef.current > timeoutMs) {
        stopPolling();
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
  }, [stopPolling, fetchStatus, intervalMs, timeoutMs, onConnected]);

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

  return {
    status,
    loading,
    error,
    isConnected: status?.linked ?? false,
    startPolling,
    stopPolling,
    refetch: fetchStatus,
  };
}
