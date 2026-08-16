import os from "node:os";

/**
 * Stable worker identity. Uses WORKER_ID when the deployment provides one
 * (existing container/process identity convention); otherwise falls back
 * to hostname — no dependency on the Docker API.
 */
export function resolveWorkerId(): string {
  const fromEnv = process.env.WORKER_ID?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : os.hostname();
}
