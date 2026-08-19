/**
 * Shared, pure helpers for deciding whether a WordPress article source is
 * actually Elementor/Web Story *content* (not just a leftover meta key)
 * and for turning Web Story AMP chrome into linear HTML the existing
 * Phoenix content pipeline already knows how to convert.
 *
 * Nothing here downloads media or writes a database.
 */

const STORY_META_KEYS = ["wp-story-image", "wp-story-cycle-image"] as const;
const ELEMENTOR_DATA_KEY = "_elementor_data";
const ELEMENTOR_TEMPLATE_TYPE_KEY = "_elementor_template_type";

export type WordPressPostMetaByKeyLike = Readonly<Record<string, readonly string[] | undefined>>;

export function firstMetaValue(postMeta: WordPressPostMetaByKeyLike, key: string): string | null {
  return postMeta[key]?.[0] ?? null;
}

export function isBlankMetaValue(value: string | null | undefined): boolean {
  return value == null || value.trim() === "";
}

/**
 * True when `_elementor_data` carries a real builder tree (widgets / nested
 * elements), not an empty string, whitespace, `[]`, `{}`, `null`, or a
 * section/column shell with no widgets.
 *
 * `_elementor_template_type` alone is never enough — WordPress leaves that
 * key on posts that were opened in Elementor even when the saved payload is
 * empty and `post_content` is the real article.
 */
export function isMeaningfulElementorPayload(raw: string | null | undefined): boolean {
  if (isBlankMetaValue(raw)) return false;
  const trimmed = raw!.trim();
  try {
    return elementorTreeHasContent(JSON.parse(trimmed));
  } catch {
    // Non-JSON non-empty payloads (PHP-serialized, truncated dumps) are
    // treated as real builder data — we refuse to guess they are empty.
    return true;
  }
}

function elementorTreeHasContent(node: unknown, depth = 0): boolean {
  if (node == null || depth > 40) return false;
  if (Array.isArray(node)) return node.some((item) => elementorTreeHasContent(item, depth + 1));
  if (typeof node !== "object") return false;
  const obj = node as Record<string, unknown>;
  const widgetType = typeof obj.widgetType === "string" ? obj.widgetType.trim() : "";
  if (widgetType) return true;
  if (obj.elType === "widget") return true;
  if (Array.isArray(obj.elements) && obj.elements.some((item) => elementorTreeHasContent(item, depth + 1))) {
    return true;
  }
  return false;
}

export function hasMeaningfulElementorMeta(postMeta: WordPressPostMetaByKeyLike): boolean {
  const dataValues = postMeta[ELEMENTOR_DATA_KEY] ?? [];
  return dataValues.some((value) => isMeaningfulElementorPayload(value));
}

export function hasWebStoryMeta(postMeta: WordPressPostMetaByKeyLike): boolean {
  return STORY_META_KEYS.some((key) => (postMeta[key] ?? []).some((value) => !isBlankMetaValue(value)));
}

/**
 * Deterministic AMP/Web Story chrome → linear HTML. No layout guessing:
 * page order is preserved as `<section>` boundaries; `amp-img` becomes
 * `<img>` with the same attributes. A document without AMP tags is returned
 * unchanged (apart from those exact substitutions, which are no-ops).
 */
export function linearizeArticleSourceHtml(raw: string): string {
  if (!raw) return raw;
  let html = raw;
  html = html.replace(/<amp-analytics\b[\s\S]*?<\/amp-analytics>/gi, "");
  html = html.replace(/<amp-pixel\b[^>]*\/?>/gi, "");
  html = html.replace(/<amp-story-bookend\b[\s\S]*?<\/amp-story-bookend>/gi, "");
  html = html.replace(/<amp-story-page-attachment\b[\s\S]*?<\/amp-story-page-attachment>/gi, "");
  html = html.replace(/<\/?amp-story-cta-layer\b[^>]*>/gi, "");
  html = html.replace(/<amp-story-page\b[^>]*>/gi, "<section>");
  html = html.replace(/<\/amp-story-page>/gi, "</section>");
  html = html.replace(/<\/?amp-story-grid-layer\b[^>]*>/gi, "");
  html = html.replace(/<\/?amp-story\b[^>]*>/gi, "");
  html = html.replace(/<amp-img\b([^>]*)>(?:\s*<\/amp-img>)?/gi, (_full, attrs: string) => `<img${attrs}>`);
  return html;
}

const WP_IMAGE_CLASS_PATTERN = /wp-image-(\d+)/g;
const DATA_ATTACHMENT_ID_PATTERN = /\b(?:data-id|data-attachment-id|data-attachment_id)=["']?(\d+)/gi;

export function extractInlineImageAttachmentIdsFromHtml(content: string): number[] {
  const ids = new Set<number>();
  for (const match of content.matchAll(WP_IMAGE_CLASS_PATTERN)) {
    const id = Number(match[1]);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  for (const match of content.matchAll(DATA_ATTACHMENT_ID_PATTERN)) {
    const id = Number(match[1]);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

/**
 * Conservative attachment-id lift from Web Story postmeta. Accepts:
 * - a bare integer string
 * - a JSON array of integers
 * - JSON objects whose `id` / `attachment_id` / `attachmentId` fields are integers
 *
 * Random numbers nested under other keys are ignored.
 */
export function extractStoryAttachmentIds(postMeta: WordPressPostMetaByKeyLike): number[] {
  const ids = new Set<number>();
  for (const key of STORY_META_KEYS) {
    for (const value of postMeta[key] ?? []) {
      collectStoryIdsFromMetaValue(value, ids);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

function collectStoryIdsFromMetaValue(value: string, ids: Set<number>): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  if (/^\d+$/.test(trimmed)) {
    ids.add(Number(trimmed));
    return;
  }
  try {
    walkStoryJson(JSON.parse(trimmed), ids, 0, false);
  } catch {
    // Non-JSON story meta is left unread rather than scraped for digits.
  }
}

function walkStoryJson(node: unknown, ids: Set<number>, depth: number, idContext: boolean): void {
  if (node == null || depth > 20) return;
  if (typeof node === "number" && Number.isSafeInteger(node) && node > 0 && idContext) {
    ids.add(node);
    return;
  }
  if (typeof node === "string" && /^\d+$/.test(node) && idContext) {
    ids.add(Number(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      if (typeof item === "number" && Number.isSafeInteger(item) && item > 0) ids.add(item);
      else walkStoryJson(item, ids, depth + 1, idContext);
    }
    return;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const nextIdContext = key === "id" || key === "attachment_id" || key === "attachmentId";
      walkStoryJson(value, ids, depth + 1, nextIdContext);
    }
  }
}

/**
 * Story-meta attachment ids that never appear as `wp-image-<id>` in the
 * linearized HTML are appended as placeholder `<img>` tags so the existing
 * media pipeline can import them in meta order without inventing layout.
 */
export function appendMissingStoryImages(html: string, storyAttachmentIds: readonly number[]): string {
  if (storyAttachmentIds.length === 0) return html;
  const already = new Set(extractInlineImageAttachmentIdsFromHtml(html));
  const extras = storyAttachmentIds.filter((id) => !already.has(id));
  if (extras.length === 0) return html;
  const tags = extras.map((id) => `<img class="wp-image-${id}" src="attachment:${id}" alt="" />`).join("\n");
  return html.trim() ? `${html.trim()}\n${tags}` : tags;
}

export const ARTICLE_ELEMENTOR_DATA_META_KEY = ELEMENTOR_DATA_KEY;
export const ARTICLE_ELEMENTOR_TEMPLATE_TYPE_META_KEY = ELEMENTOR_TEMPLATE_TYPE_KEY;
export const ARTICLE_WEB_STORY_META_KEYS = STORY_META_KEYS;
