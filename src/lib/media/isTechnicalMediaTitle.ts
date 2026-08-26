/**
 * Detects MediaAsset.title values that are not useful as human-readable titles
 * (camera dumps, numeric IDs, content hashes, neutral import placeholders).
 * Meaningful source titles (e.g. "Клуб английского языка Малберри Клаб 02")
 * must NOT match.
 */

const IMAGE_EXT = "(?:jpe?g|png|webp|gif|heic|heif|avif|bmp|svg)";

export function stripMediaTitleExtension(raw: string): string {
  return raw.trim().replace(new RegExp(`\\.${IMAGE_EXT}$`, "i"), "");
}

/** Normalize for comparing title ↔ originalName / filename stems. */
export function normalizeMediaTitleKey(raw: string | null | undefined): string {
  if (raw == null) return "";
  return stripMediaTitleExtension(raw)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "");
}

/**
 * True when title is essentially the upload basename (optionally with -scaled/-min/copy noise).
 */
export function isTitleDerivedFromOriginalName(
  title: string | null | undefined,
  originalName: string | null | undefined,
): boolean {
  const titleKey = normalizeMediaTitleKey(title);
  const originalKey = normalizeMediaTitleKey(originalName);
  if (!titleKey || !originalKey || titleKey.length < 3) return false;
  if (titleKey === originalKey) return true;
  // Common upload suffixes glued onto the same stem
  const stripNoise = (value: string) =>
    value.replace(/(?:scaled|min|copy|edited|orig|original)+$/i, "").replace(/\d+$/, "");
  const t = stripNoise(titleKey);
  const o = stripNoise(originalKey);
  if (t.length >= 3 && (t === o || originalKey.startsWith(titleKey) || titleKey.startsWith(originalKey))) {
    return true;
  }
  return false;
}

export function isTechnicalMediaTitle(raw: string | null | undefined): boolean {
  if (raw == null) return true;
  const t = raw.trim();
  if (!t) return true;

  // Neutral import / placeholder identity
  if (/^(media|image|картинка|изображение)$/i.test(t)) return true;

  const withoutExt = stripMediaTitleExtension(t);

  if (/^\d+([_-]\d+)*$/i.test(withoutExt)) return true;
  if (/^(IMG|DSC|DCIM|PXL|Screenshot|photo|image|PIC)[_-]?\d+/i.test(withoutExt)) return true;
  if (/^[a-f0-9]{8,}([-_][a-f0-9]+)*$/i.test(withoutExt)) return true;
  if (/^\d{4}x\d{4}/i.test(withoutExt)) return true;
  if (/^0x[a-f0-9]+/i.test(withoutExt)) return true;
  // Timestamp-only dumps from phones / cameras
  if (/^\d{4}-\d{2}-\d{2}[ T._-]\d{2}[.:]\d{2}([.:]\d{2})?$/i.test(withoutExt)) return true;
  // photo_YYYY-MM-DD_HH-MM-SS (+ optional copy suffix)
  if (/^photo[_-]\d{4}-\d{2}-\d{2}[_-]\d{2}[_.:-]\d{2}/i.test(withoutExt)) return true;
  // Unsplash / stock photographer dumps: name-hash-unsplash
  if (/unsplash/i.test(withoutExt)) return true;
  if (/^[a-z]+-[a-z]+-[a-z0-9]{6,}(-[a-z0-9]+)*$/i.test(withoutExt) && !/[а-яё]/i.test(withoutExt)) {
    return true;
  }
  // Filename-like with extension still present in the title string
  if (new RegExp(`\\.${IMAGE_EXT}$`, "i").test(t) && !/[а-яё\s]/i.test(withoutExt)) {
    return true;
  }
  // Bare slug-like WP post_name with no spaces / Cyrillic (weak signal — only short)
  if (
    /^[a-z0-9]+(-[a-z0-9]+){0,2}$/i.test(withoutExt) &&
    withoutExt.length <= 12 &&
    !/[а-яё]/i.test(withoutExt)
  ) {
    return true;
  }

  return false;
}
