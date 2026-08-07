/**
 * Detects WordPress attachment titles / filenames that are not useful as
 * human-readable MediaAsset.title (camera dumps, numeric IDs, content hashes).
 * Meaningful source titles (e.g. "Клуб английского языка Малберри Клаб 02")
 * must NOT match.
 */
export function isTechnicalMediaTitle(raw: string | null | undefined): boolean {
  if (raw == null) return true;
  const t = raw.trim();
  if (!t) return true;

  const withoutExt = t.replace(/\.(jpe?g|png|webp|gif|jpeg|heic|heif|avif)$/i, "");

  if (/^\d+([_-]\d+)*$/i.test(withoutExt)) return true;
  if (/^(IMG|DSC|DCIM|PXL|Screenshot|photo|image|PIC)[_-]?\d+/i.test(withoutExt)) return true;
  if (/^[a-f0-9]{8,}([-_][a-f0-9]+)*$/i.test(withoutExt)) return true;
  if (/^\d{4}x\d{4}/i.test(withoutExt)) return true;
  if (/^0x[a-f0-9]+/i.test(withoutExt)) return true;
  // Timestamp-only dumps from phones / cameras
  if (/^\d{4}-\d{2}-\d{2}[ T._-]\d{2}[.:]\d{2}([.:]\d{2})?$/i.test(withoutExt)) return true;

  // Bare slug-like WP post_name with no spaces / Cyrillic (weak signal — only short)
  if (/^[a-z0-9]+(-[a-z0-9]+){0,2}$/i.test(withoutExt) && withoutExt.length <= 12 && !/[а-яё]/i.test(withoutExt)) {
    return true;
  }

  return false;
}
