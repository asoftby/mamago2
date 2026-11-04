/**
 * Client-side family-picks requests. Lifecycle cancellation is not an error:
 * React dev Strict Mode and chip changes routinely invalidate in-flight loads.
 *
 * We intentionally do not pass the lifecycle signal to fetch: aborting a fetch
 * can surface as a Next.js dev overlay, even when the rejection is handled.
 * The race resolves null immediately; late responses are ignored.
 */
export async function postFamilyPicks(
  body: Record<string, unknown>,
  signal?: AbortSignal,
  timeoutMs = 15_000,
) {
  // Strict Mode cleanup often occurs before the microtask starts a request.
  await Promise.resolve();
  if (signal?.aborted) return null;

  let cancel: (() => void) | undefined;
  const cancelled = new Promise<null>((resolve) => {
    cancel = () => resolve(null);
    signal?.addEventListener("abort", cancel, { once: true });
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("home_request_timeout")), timeoutMs);
  });
  try {
    if (signal?.aborted) return null;
    const request = fetch("/api/recommendations/family-picks", {
      method: "POST", credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: body.action === "dismiss",
    }).then(async (response) => {
      if (!response.ok) throw new Error(`home_${response.status}`);
      return response.json();
    });
    return await Promise.race([request, cancelled, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    if (cancel) signal?.removeEventListener("abort", cancel);
  }
}
