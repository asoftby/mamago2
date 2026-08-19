/**
 * Normalizes free-form Instagram input (`@username`, a bare username, or a
 * full profile URL) into the bare handle stored on `Place.instagramHandle`,
 * plus the canonical `instagramUrl` derived from it. Used by both the
 * Contacts step's input and anywhere else that needs the same normalization.
 */
export function normalizeInstagramHandle(value: string): {
  instagramHandle: string;
  instagramUrl: string | null;
} {
  let normalized = value.trim();
  if (normalized.startsWith("@")) {
    normalized = normalized.slice(1);
  }
  if (normalized.includes("instagram.com/")) {
    normalized = normalized.split("instagram.com/")[1].split("/")[0];
  }
  return {
    instagramHandle: normalized,
    instagramUrl: normalized ? `https://instagram.com/${normalized}` : null,
  };
}

/**
 * Whether the Photos step should offer one-click Instagram avatar import —
 * only once a handle is set (Contacts step) and the wizard has a session to
 * upload into. A missing handle must never block or affect the normal
 * manual logo upload — it only means this optional shortcut isn't shown.
 */
export function shouldShowInstagramAvatarImport(params: {
  instagramHandle: string | null | undefined;
  wizardSessionId: string | null | undefined;
}): boolean {
  return !!params.instagramHandle?.trim() && !!params.wizardSessionId;
}
