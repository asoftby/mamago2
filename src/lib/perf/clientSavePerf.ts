const CLIENT_DEBUG_SAVE_PERF =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_DEBUG_SAVE_PERF === "true";

type ClientPerfMetaValue = string | number | boolean | null | undefined;

function formatPayloadSize(payload: unknown): string {
  if (payload == null) return "0b";
  try {
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    const bytes = new TextEncoder().encode(raw).length;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}mb`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)}kb`;
    return `${bytes}b`;
  } catch {
    return "unknown";
  }
}

export function isClientSavePerfEnabled(): boolean {
  return CLIENT_DEBUG_SAVE_PERF;
}

export function createClientSavePerf(
  scope: string,
  options: {
    endpoint: string;
    payload?: unknown;
  },
) {
  const enabled = isClientSavePerfEnabled();
  const started = enabled ? performance.now() : 0;
  const payloadSize = formatPayloadSize(options.payload);

  return {
    log(meta?: Record<string, ClientPerfMetaValue>) {
      if (!enabled) return 0;
      const total = Math.round(performance.now() - started);
      const parts = [
        `endpoint=${options.endpoint}`,
        `payload=${payloadSize}`,
        `total=${total}ms`,
      ];

      if (meta) {
        for (const [key, value] of Object.entries(meta)) {
          if (value !== undefined) {
            parts.push(`${key}=${value}`);
          }
        }
      }

      console.log(`[${scope}] ${parts.join(" ")}`);
      return total;
    },
  };
}
