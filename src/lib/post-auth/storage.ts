import type { PostAuthContext } from "./types";

const KEY = "mamaGo_post_auth_context_v2";
const TTL_MS = 60 * 60 * 1000;

function now() {
  return Date.now();
}

export function savePostAuthContext(
  partial: Omit<PostAuthContext, "createdAt"> & { createdAt?: number },
): void {
  if (typeof window === "undefined") return;
  try {
    const ctx: PostAuthContext = {
      source: partial.source,
      authAction: partial.authAction ?? null,
      pendingAction: partial.pendingAction,
      returnTo: partial.returnTo,
      createdAt: partial.createdAt ?? now(),
    };
    window.sessionStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

export function getPostAuthContext(): PostAuthContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const ctx = JSON.parse(raw) as PostAuthContext;
    if (!ctx || typeof ctx.source !== "string") return null;
    if (now() - ctx.createdAt > TTL_MS) {
      clearPostAuthContext();
      return null;
    }
    return ctx;
  } catch {
    return null;
  }
}

export function clearPostAuthAction(): void {
  const context = getPostAuthContext();
  if (!context || context.authAction == null) return;

  savePostAuthContext({
    ...context,
    authAction: null,
  });
}

export function clearPostAuthContext(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
