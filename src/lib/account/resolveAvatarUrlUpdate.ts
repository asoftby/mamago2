/**
 * Validates `avatarUrl` from PATCH /api/auth/me.
 *
 * Only `null` (remove photo) or the public URL of a media asset uploaded by the
 * same user is accepted, so a profile can never point at an arbitrary external
 * URL or at someone else's upload.
 */
export type AvatarUrlUpdate =
  | { kind: "none" }
  | { kind: "set"; avatarUrl: string | null }
  | { kind: "invalid" };

export const MAX_AVATAR_URL_LENGTH = 2048;

export async function resolveAvatarUrlUpdate(
  body: unknown,
  isOwnUploadedMediaUrl: (url: string) => Promise<boolean>,
): Promise<AvatarUrlUpdate> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { kind: "none" };
  if (!("avatarUrl" in body)) return { kind: "none" };
  const value = (body as Record<string, unknown>).avatarUrl;
  if (value === null) return { kind: "set", avatarUrl: null };
  if (typeof value !== "string") return { kind: "invalid" };
  const url = value.trim();
  if (!url || url.length > MAX_AVATAR_URL_LENGTH) return { kind: "invalid" };
  return (await isOwnUploadedMediaUrl(url)) ? { kind: "set", avatarUrl: url } : { kind: "invalid" };
}
