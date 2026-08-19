import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";

/**
 * The one WordPress usermeta key this importer ever reads. Voxel (the
 * legacy theme's profile plugin) stores a user's custom-uploaded avatar as
 * this key's value — a `wp_posts` attachment id, same convention as
 * `_thumbnail_id`/`gallery` elsewhere in this migration. Every other avatar
 * mechanism WordPress/Voxel supports (`wptg_login_avatar` Telegram photos —
 * `t.me` URLs, not attachment ids; Gravatar; the theme's own
 * mystery/default placeholder) lives under a *different* meta_key or has no
 * usermeta row at all, so restricting the source query to exactly this key
 * (see `buildUserMetaQuery` callers) is what keeps those out — no separate
 * denylist is needed for the common case.
 */
export const VOXEL_AVATAR_META_KEY = "voxel:avatar";

export type VoxelAvatarSourceClassification =
  | { status: "NO_AVATAR_SOURCE" }
  | { status: "AVATAR_NON_ATTACHMENT_VALUE"; rawValue: string }
  | { status: "AVATAR_ATTACHMENT_MISSING"; attachmentId: number }
  | { status: "AVATAR_ATTACHMENT_VALID"; attachmentId: number; attachment: WordPressAttachmentRow };

/**
 * Parses a raw `voxel:avatar` meta_value into a `wp_posts` attachment id.
 * Only a plain positive integer (optionally whitespace-padded, WordPress's
 * own `absint()`-style convention for id meta) counts — anything else
 * (empty string, a `t.me` URL, a Gravatar hash, a mystery-avatar filename)
 * is treated as non-attachment, belt-and-suspenders against the same
 * sentinel-style values leaking into this key on a source row that doesn't
 * match the documented convention.
 */
function parseAttachmentId(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!/^[0-9]+$/.test(trimmed)) return null;
  const id = Number(trimmed);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

/**
 * Classifies one user's `voxel:avatar` source evidence: no value at all
 * (leave `User.avatarUrl` untouched), a non-attachment value (skip — covers
 * Telegram/Gravatar/default sentinels that shouldn't be under this key but
 * are rejected defensively rather than trusted), a broken reference (the
 * attachment id is present but the `wp_posts` row doesn't exist — an
 * explained skip, not a failure), or a valid, importable attachment.
 */
export function classifyVoxelAvatarSource(input: {
  rawMetaValue: string | null | undefined;
  attachmentsById: ReadonlyMap<number, WordPressAttachmentRow>;
}): VoxelAvatarSourceClassification {
  const rawValue = input.rawMetaValue?.trim();
  if (!rawValue) return { status: "NO_AVATAR_SOURCE" };

  const attachmentId = parseAttachmentId(rawValue);
  if (attachmentId === null) return { status: "AVATAR_NON_ATTACHMENT_VALUE", rawValue };

  const attachment = input.attachmentsById.get(attachmentId);
  if (!attachment) return { status: "AVATAR_ATTACHMENT_MISSING", attachmentId };

  return { status: "AVATAR_ATTACHMENT_VALID", attachmentId, attachment };
}
