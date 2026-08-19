import type { WordPressAttachmentRow } from "./types";

/**
 * The real, fetchable file URL for a WordPress attachment — never `guid`
 * directly. Confirmed 2026-07-16 against the live site: `guid` resolves to
 * the attachment's HTML permalink page (`text/html`), not the uploaded
 * file, for every attachment checked. `attached_file`
 * (`wp_postmeta._wp_attached_file`, the uploads-relative path WordPress
 * itself uses to serve the real file — e.g. `2023/07/abc123.webp`) is the
 * reliable field; verified directly by fetching the constructed URL for a
 * real attachment (`HTTP 200`, `content-type: image/webp`, `content-length`
 * matching the stored filesize exactly).
 *
 * `/wp-content/uploads/` is WordPress's own default uploads path — this
 * site shows no evidence of a custom `UPLOADS`/CDN rewrite, so it's used
 * as-is rather than introducing config for a scenario not yet observed.
 * `guid`'s *origin* (not its full path) is still used to build the result,
 * since `attached_file` itself has no host — falls back to `guid` verbatim
 * if `attached_file` is absent or `guid` isn't a parseable absolute URL
 * (matching this function's pre-existing behavior for every fixture/test
 * that never sets `attached_file`).
 */
export function resolveWordPressAttachmentFileUrl(
  attachment: Pick<WordPressAttachmentRow, "guid" | "attached_file">,
): string | null {
  const attachedFile = attachment.attached_file?.trim();
  if (attachedFile) {
    try {
      const origin = new URL(attachment.guid).origin;
      return `${origin}/wp-content/uploads/${attachedFile}`;
    } catch {
      // guid isn't a parseable absolute URL to pull an origin from — fall
      // through to the guid-verbatim fallback below.
    }
  }
  return attachment.guid?.trim() || null;
}
