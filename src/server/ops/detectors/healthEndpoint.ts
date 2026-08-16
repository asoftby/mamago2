/**
 * Detector #1: health_endpoint (§21 Step 3, Phase C).
 *
 * Probes the PUBLIC route through Traefik — never localhost/container
 * hostname/internal port — so this exercises the real path:
 * worker -> DNS/public host -> TLS -> Traefik -> web -> health route -> DB.
 *
 * Fingerprint keeps the frozen `prod` discriminator even when this runs in
 * DEV during validation (no existing environment-discriminator contract
 * to redesign around — see the Step 3 final report).
 */
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";
import type { Detector, DetectorContext, DetectorResult, SignalDraft } from "../types";

export const HEALTH_ENDPOINT_FINGERPRINT = "health.endpoint_failed:prod";
export const HEALTH_ENDPOINT_TIMEOUT_MS = 5_000;

export type HealthEndpointProbeOutcome =
  | { kind: "network_error"; message: string }
  | { kind: "timeout" }
  | { kind: "http_error"; httpStatus: number }
  | { kind: "invalid_json" }
  | { kind: "parsed"; httpStatus: number; body: unknown };

export async function probeHealthEndpoint(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  timeoutMs: number = HEALTH_ENDPOINT_TIMEOUT_MS,
): Promise<HealthEndpointProbeOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetchImpl(url, { signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) {
        return { kind: "timeout" };
      }
      return { kind: "network_error", message: err instanceof Error ? err.message : String(err) };
    }

    if (!res.ok) {
      return { kind: "http_error", httpStatus: res.status };
    }

    const text = await res.text();
    try {
      const body = JSON.parse(text) as unknown;
      return { kind: "parsed", httpStatus: res.status, body };
    } catch {
      return { kind: "invalid_json" };
    }
  } finally {
    clearTimeout(timer);
  }
}

function failureSignal(summary: string): SignalDraft {
  return {
    fingerprint: HEALTH_ENDPOINT_FINGERPRINT,
    type: "HEALTH_ENDPOINT_FAILED",
    severity: "CRITICAL",
    title: "Public health endpoint failing",
    summary,
  };
}

export function evaluateHealthEndpoint(probe: HealthEndpointProbeOutcome): DetectorResult {
  switch (probe.kind) {
    case "network_error":
      return { samples: [], signals: [failureSignal(`network error: ${probe.message}`)] };
    case "timeout":
      return { samples: [], signals: [failureSignal(`request timed out after ${HEALTH_ENDPOINT_TIMEOUT_MS}ms`)] };
    case "http_error":
      return { samples: [], signals: [failureSignal(`unexpected HTTP status ${probe.httpStatus}`)] };
    case "invalid_json":
      return { samples: [], signals: [failureSignal("response body is not valid JSON")] };
    case "parsed": {
      const body = probe.body && typeof probe.body === "object" ? (probe.body as Record<string, unknown>) : null;
      const status = body?.status;
      const db = body?.db;
      if (status === "ok" && db === "ok") {
        return { samples: [], signals: [] };
      }
      return {
        samples: [],
        signals: [failureSignal(`unhealthy payload: status=${String(status)} db=${String(db)}`)],
      };
    }
  }
}

export interface HealthObservedRuntime {
  buildId: string;
  gitSha: string | null;
  processStartedAt: Date;
}

/**
 * Extracts buildId/gitSha/processStartedAt from an already-fetched healthy
 * probe, for ReleaseEvent reuse (Phase I) — never a second HTTP call.
 * Returns null when the probe wasn't a healthy parsed response, or when
 * buildId/processStartedAt aren't present (e.g. BUILD_ID unset outside a
 * built image) — there is nothing meaningful to key a release on then.
 */
export function extractHealthReleaseMetadata(probe: HealthEndpointProbeOutcome): HealthObservedRuntime | null {
  if (probe.kind !== "parsed") return null;
  const body = probe.body && typeof probe.body === "object" ? (probe.body as Record<string, unknown>) : null;
  if (!body) return null;

  const buildId = typeof body.buildId === "string" ? body.buildId : null;
  const gitSha = typeof body.gitSha === "string" ? body.gitSha : null;
  const processStartedAtRaw = typeof body.processStartedAt === "string" ? body.processStartedAt : null;
  if (!buildId || !processStartedAtRaw) return null;

  const processStartedAt = new Date(processStartedAtRaw);
  if (Number.isNaN(processStartedAt.getTime())) return null;

  return { buildId, gitSha, processStartedAt };
}

export const healthEndpointDetector: Detector<HealthEndpointProbeOutcome> = {
  name: "health_endpoint",
  intervalSec: 60,
  timeoutMs: HEALTH_ENDPOINT_TIMEOUT_MS,
  nodes: ["PROD"],
  probe: async (ctx: DetectorContext) => {
    const url = `${getCanonicalPublicAppUrl()}/api/health`;
    return probeHealthEndpoint(ctx.fetch, url, HEALTH_ENDPOINT_TIMEOUT_MS);
  },
  evaluate: evaluateHealthEndpoint,
};
