import type { ArticleBlockMvp, ArticleContentPayload } from "@/lib/publications/articleMvp";

export type MigrationContentSourceKind =
  | "wordpress"
  | "google-places"
  | "csv"
  | "excel"
  | "partner-api"
  | "json"
  | "unknown";

export type NormalizedContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "bulletList"; items: string[] }
  | { type: "orderedList"; items: string[] }
  | { type: "link"; text: string; href: string }
  | {
      type: "image";
      src: string;
      alt?: string;
      /** WordPress attachment id (`wp-image-<id>` class), when the source `class` attribute carried one — only ever populated in `preserveImagePositions` mode, since `stripNoisyHtml()` strips `class` before the default extraction path ever runs. */
      attachmentId?: number;
    };

export type ContentNormalizationWarningCode =
  | "UNSUPPORTED_ARTICLE_BLOCK_DOWNCONVERTED"
  | "EMPTY_IMAGE_REMOVED"
  | "UNSAFE_LINK_REMOVED";

export interface ContentNormalizationWarning {
  code: ContentNormalizationWarningCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ContentNormalizationInput {
  raw: string;
  sourceKind?: MigrationContentSourceKind;
  /**
   * When true, image blocks are interleaved into `blocks` at their original
   * document position instead of being extracted separately and appended
   * after every text block (the default, unset/false behavior — used by
   * every caller except Article media replay). Never changes the resulting
   * non-image block sequence or their order — only where image blocks land
   * relative to them. See `extractMediaBlocksInline()`.
   */
  preserveImagePositions?: boolean;
}

export interface ContentNormalizationResult {
  sourceKind: MigrationContentSourceKind;
  blocks: NormalizedContentBlock[];
  plainText: string;
  warnings: ContentNormalizationWarning[];
}

const ARTICLE_CONTENT_VERSION = 1 as const;
const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\uFEFF]/g;
const TRACKING_QUERY_PARAMS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

const HEADING_LABELS = [
  "адрес",
  "контакты",
  "контактная информация",
  "цены",
  "стоимость",
  "преимущества",
  "режим работы",
  "время работы",
  "условия",
  "instagram",
];

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function normalizeWhitespace(value: string): string {
  return decodeBasicEntities(value)
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(ZERO_WIDTH_PATTERN, "")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]{2,}/g, " ")
    .replace(/[ \u00A0]+\n/g, "\n")
    .replace(/\n[ \u00A0]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtmlTags(value: string): string {
  return normalizeWhitespace(value.replace(/<[^>]+>/g, " "));
}

function stripNoisyHtml(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/\s(?:class|style|id|data-[\w:-]+|aria-[\w:-]+)=(".*?"|'.*?'|[^\s>]+)/gi, "");
}

function normalizeUrl(rawHref: string): string | null {
  const href = decodeBasicEntities(rawHref).trim();
  if (!href) return null;
  if (/^(javascript|mailto):/i.test(href)) return null;
  if (href.startsWith("#")) return href;

  try {
    const url = new URL(href);
    for (const param of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_PARAMS.has(param.toLowerCase())) {
        url.searchParams.delete(param);
      }
    }
    return url.toString();
  } catch {
    return href;
  }
}

function extractMediaBlocks(html: string, warnings: ContentNormalizationWarning[]): NormalizedContentBlock[] {
  const blocks: NormalizedContentBlock[] = [];
  const imagePattern = /<img\b([^>]*)>/gi;
  for (const match of html.matchAll(imagePattern)) {
    const attrs = match[1] ?? "";
    const src = attrs.match(/\ssrc=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean)?.trim() ?? "";
    if (!src) {
      warnings.push({ code: "EMPTY_IMAGE_REMOVED", message: "Removed img without src." });
      continue;
    }
    const alt = attrs.match(/\salt=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean)?.trim();
    blocks.push({ type: "image", src: normalizeUrl(src) ?? src, alt: alt ? stripHtmlTags(alt) : undefined });
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Position-preserving image extraction (`preserveImagePositions: true` only)
// ---------------------------------------------------------------------------

/**
 * A literal NUL char (`\u0000`) can never occur in real WordPress HTML
 * (stripped by MySQL's `TEXT` column semantics long before this pipeline
 * sees it), so it's a safe, literal-collision-free placeholder delimiter —
 * no escaping/encoding scheme needed, unlike a plain-word token.
 */
const IMAGE_PLACEHOLDER_OPEN = "\u0000IMG_BLOCK_";
const IMAGE_PLACEHOLDER_CLOSE = "\u0000";
const IMAGE_PLACEHOLDER_PATTERN = /^\u0000IMG_BLOCK_(\d+)\u0000$/;

const WP_IMAGE_CLASS_PATTERN = /wp-image-(\d+)/;

/**
 * `stripNoisyHtml()` deliberately strips every `class` attribute (it's
 * text-cleaning noise for every other purpose) before either image
 * extraction path ever runs — so a WordPress `wp-image-<id>` class, if one
 * is needed, must be read from the *original*, pre-stripped `raw` HTML,
 * not `cleanedHtml`. Returns one entry per `<img>` tag encountered, in the
 * same document order `extractMediaBlocksInline()` encounters them in
 * `cleanedHtml` — `stripNoisyHtml()`/`normalizeAnchors()` only ever strip
 * attributes or unwrap anchors, they never remove, duplicate, or reorder
 * an `<img>` tag itself, so index-based correlation between this array and
 * `extractMediaBlocksInline()`'s output is safe.
 */
function extractOrderedWordPressAttachmentIds(rawHtml: string): (number | null)[] {
  const ids: (number | null)[] = [];
  for (const match of rawHtml.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = match[1] ?? "";
    const classAttr = attrs.match(/\sclass=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean) ?? "";
    const idMatch = WP_IMAGE_CLASS_PATTERN.exec(classAttr);
    ids.push(idMatch ? Number(idMatch[1]) : null);
  }
  return ids;
}

/**
 * Same `<img>` extraction as `extractMediaBlocks()`, fused with substitution
 * instead of two independent passes: each `<img>` is replaced in-place by a
 * standalone-line placeholder token (so it becomes its own block through
 * the exact same `htmlToLogicalLines()`/`linesToBlocks()` pipeline the
 * default path already uses — no second HTML parser), while the actual
 * image data is collected in encounter order for `interleaveImageBlocks()`
 * to substitute back in after block-splitting. `orderedAttachmentIds` (see
 * `extractOrderedWordPressAttachmentIds()`) is correlated purely by
 * encounter order, since `class` is already gone from `html` by this point.
 */
function extractMediaBlocksInline(
  html: string,
  orderedAttachmentIds: readonly (number | null)[],
  warnings: ContentNormalizationWarning[],
): { htmlWithPlaceholders: string; imageBlocks: Extract<NormalizedContentBlock, { type: "image" }>[] } {
  const imageBlocks: Extract<NormalizedContentBlock, { type: "image" }>[] = [];
  const htmlWithPlaceholders = html.replace(/<img\b([^>]*)>/gi, (_full, attrsRaw: string) => {
    const attrs = attrsRaw ?? "";
    const src = attrs.match(/\ssrc=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean)?.trim() ?? "";
    if (!src) {
      warnings.push({ code: "EMPTY_IMAGE_REMOVED", message: "Removed img without src." });
      return "\n";
    }
    const alt = attrs.match(/\salt=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean)?.trim();
    const index = imageBlocks.length;
    const attachmentId = orderedAttachmentIds[index] ?? undefined;
    imageBlocks.push({
      type: "image",
      src: normalizeUrl(src) ?? src,
      alt: alt ? stripHtmlTags(alt) : undefined,
      attachmentId,
    });
    // Wrapped in its own newlines so it becomes a standalone line/block
    // regardless of surrounding markup (e.g. `<figure>`, which isn't one of
    // `htmlToLogicalLines()`'s explicit block-boundary tags).
    return `\n${IMAGE_PLACEHOLDER_OPEN}${index}${IMAGE_PLACEHOLDER_CLOSE}\n`;
  });
  return { htmlWithPlaceholders, imageBlocks };
}

/**
 * Swaps each placeholder-only paragraph block back for its real image
 * block, in place. A placeholder that ends up merged into a larger line
 * (inline `<img>` mixed with surrounding text, not this site's observed
 * pattern but not impossible) is deliberately left as literal placeholder
 * text rather than guessed at — caught downstream by the content
 * divergence preflight, never silently dropped or misplaced.
 */
function interleaveImageBlocks(
  blocks: readonly NormalizedContentBlock[],
  imageBlocks: readonly Extract<NormalizedContentBlock, { type: "image" }>[],
): NormalizedContentBlock[] {
  return blocks.flatMap((block): NormalizedContentBlock[] => {
    if (block.type !== "paragraph") return [block];
    const match = IMAGE_PLACEHOLDER_PATTERN.exec(block.text.trim());
    if (!match) return [block];
    const image = imageBlocks[Number(match[1])];
    return image ? [image] : [block];
  });
}

function normalizeAnchors(html: string, warnings: ContentNormalizationWarning[]): string {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_full, attrs: string, body: string) => {
    const text = stripHtmlTags(body);
    // A common WordPress gallery pattern: `<a href="{full-size-image}"><img .../></a>`
    // ("Media File" link destination) — the anchor exists only to link the
    // image to itself, carries no visible text, and isn't an "empty/unsafe
    // link" in the sense the warning below means. Unwrapping it (keep the
    // `<img>`, drop the redundant self-link) lets `extractMediaBlocks()`/
    // `extractMediaBlocksInline()` see the image at all — previously this
    // exact case silently destroyed the `<img>` tag before either ever ran,
    // in both default and (new) position-preserving extraction alike.
    if (!text && /<img\b/i.test(body)) {
      return body;
    }
    const href = attrs.match(/\shref=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean) ?? "";
    const normalized = normalizeUrl(href);
    if (!text || !normalized) {
      warnings.push({
        code: "UNSAFE_LINK_REMOVED",
        message: "Removed empty or unsafe link while preserving visible text when possible.",
        details: href ? { href } : undefined,
      });
      return text;
    }
    return `${text} (${normalized})`;
  });
}

function htmlToLogicalLines(html: string): string[] {
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|section|article|header|footer|blockquote|li|ul|ol|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "- ")
    .replace(/<\s*h[1-6]\b[^>]*>/gi, "\n## ")
    .replace(/<\s*(p|div|section|article|header|footer|blockquote|ul|ol)\b[^>]*>/gi, "\n");
  return normalizeWhitespace(stripHtmlTags(withBreaks))
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function isHeadingLine(line: string): boolean {
  const cleaned = line.replace(/[:：]\s*$/, "").trim().toLowerCase();
  if (line.startsWith("## ")) return true;
  return HEADING_LABELS.includes(cleaned) || (cleaned.length <= 34 && HEADING_LABELS.some((h) => cleaned === h));
}

function normalizeHeadingText(line: string): string {
  return normalizeWhitespace(line.replace(/^##\s*/, "").replace(/[:：]\s*$/, ""));
}

function isBulletLine(line: string): boolean {
  return /^([-*•]\s+|\d+[.)]\s+)/.test(line) || /^[\d.,]+\s*(руб\.?|byn|₽|\$|€)(\s|$)/i.test(line);
}

function bulletText(line: string): string {
  return normalizeWhitespace(line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, ""));
}

function linesToBlocks(lines: string[]): NormalizedContentBlock[] {
  const blocks: NormalizedContentBlock[] = [];
  let pendingBullets: string[] = [];
  let pendingOrdered: string[] = [];

  const flushLists = () => {
    if (pendingBullets.length > 0) {
      blocks.push({ type: "bulletList", items: pendingBullets });
      pendingBullets = [];
    }
    if (pendingOrdered.length > 0) {
      blocks.push({ type: "orderedList", items: pendingOrdered });
      pendingOrdered = [];
    }
  };

  for (const line of lines) {
    if (isHeadingLine(line)) {
      flushLists();
      blocks.push({ type: "heading", level: 2, text: normalizeHeadingText(line) });
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      pendingOrdered.push(bulletText(line));
      continue;
    }
    if (isBulletLine(line)) {
      pendingBullets.push(bulletText(line));
      continue;
    }
    flushLists();
    blocks.push({ type: "paragraph", text: line });
  }
  flushLists();
  return blocks;
}

export function normalizeMigrationContent(input: ContentNormalizationInput): ContentNormalizationResult {
  const warnings: ContentNormalizationWarning[] = [];
  const sourceKind = input.sourceKind ?? "unknown";
  const cleanedHtml = normalizeAnchors(stripNoisyHtml(input.raw), warnings);

  let blocks: NormalizedContentBlock[];
  if (input.preserveImagePositions) {
    const orderedAttachmentIds = extractOrderedWordPressAttachmentIds(input.raw);
    const { htmlWithPlaceholders, imageBlocks } = extractMediaBlocksInline(cleanedHtml, orderedAttachmentIds, warnings);
    const blocksWithPlaceholders = linesToBlocks(htmlToLogicalLines(htmlWithPlaceholders));
    blocks = interleaveImageBlocks(blocksWithPlaceholders, imageBlocks);
  } else {
    const mediaBlocks = extractMediaBlocks(cleanedHtml, warnings);
    const htmlWithoutImages = cleanedHtml.replace(/<img\b[^>]*>/gi, "\n");
    const textBlocks = linesToBlocks(htmlToLogicalLines(htmlWithoutImages));
    blocks = [...textBlocks, ...mediaBlocks];
  }
  const plainText = blocks
    .flatMap((block) => {
      if (block.type === "bulletList" || block.type === "orderedList") return block.items;
      if (block.type === "image") return block.alt ? [block.alt] : [];
      return [block.text];
    })
    .join("\n")
    .trim();

  return { sourceKind, blocks, plainText, warnings };
}

function articleBlockId(index: number): string {
  return `normalized-content-block-${index + 1}`;
}

/** What `resolveImageBlock` hands back for one source image block it chose to keep. */
export interface ResolvedArticleImageBlock {
  mediaId: string;
  alt?: string;
  caption?: string;
}

/**
 * Shared downconversion core for both `normalizedContentToArticleContentJson()`
 * (default — `resolveImageBlock: null`, image blocks are always dropped with
 * a warning, exactly as before this function was extracted) and
 * `normalizedContentToArticleContentJsonWithMedia()` (Article media replay —
 * `resolveImageBlock` returns a real `MediaAsset`-backed image block instead).
 * Every other block type's handling is untouched and shared verbatim — this
 * is the "минимально параметризуй этап Article downconversion" the image
 * path needed, not a second implementation.
 *
 * `id` is only ever assigned to a block that actually gets pushed (`blocks.
 * length` at push time) — an image block that resolves to nothing (default
 * mode, or replay mode when `resolveImageBlock` itself returns null) never
 * consumes an id slot, matching the pre-extraction behavior exactly.
 */
function convertBlocks(
  sourceBlocks: readonly NormalizedContentBlock[],
  resolveImageBlock: ((block: Extract<NormalizedContentBlock, { type: "image" }>) => ResolvedArticleImageBlock | null) | null,
  warnings: ContentNormalizationWarning[],
): ArticleBlockMvp[] {
  const blocks: ArticleBlockMvp[] = [];
  let hasIntro = false;

  for (const block of sourceBlocks) {
    if (block.type === "image") {
      const resolved = resolveImageBlock?.(block) ?? null;
      if (resolved) {
        blocks.push({
          id: articleBlockId(blocks.length),
          type: "image",
          mediaId: resolved.mediaId,
          alt: resolved.alt,
          caption: resolved.caption,
        });
        continue;
      }
      warnings.push({
        code: "UNSUPPORTED_ARTICLE_BLOCK_DOWNCONVERTED",
        message: "Image block was not written because article migration media import is outside the current safe MVP scope.",
        details: { src: block.src },
      });
      continue;
    }

    const id = articleBlockId(blocks.length);
    if (block.type === "paragraph") {
      blocks.push({ id, type: hasIntro ? "text" : "intro", text: block.text });
      hasIntro = true;
      continue;
    }
    if (block.type === "heading") {
      blocks.push({ id, type: "heading", level: block.level, text: block.text });
      continue;
    }
    if (block.type === "link") {
      blocks.push({ id, type: "text", text: `${block.text}: ${block.href}` });
      continue;
    }

    warnings.push({
      code: "UNSUPPORTED_ARTICLE_BLOCK_DOWNCONVERTED",
      message: `${block.type} does not have a native Article MVP block yet; preserved as text.`,
      details: { blockType: block.type },
    });
    const lines =
      block.type === "orderedList"
        ? block.items.map((item, i) => `${i + 1}. ${item}`)
        : block.items.map((item) => `- ${item}`);
    blocks.push({ id, type: "text", text: lines.join("\n") });
  }

  return blocks;
}

export function normalizedContentToArticleContentJson(
  result: ContentNormalizationResult,
): { contentJson: ArticleContentPayload; warnings: ContentNormalizationWarning[] } {
  const warnings = [...result.warnings];
  const blocks = convertBlocks(result.blocks, null, warnings);
  return {
    contentJson: {
      version: ARTICLE_CONTENT_VERSION,
      blocks,
    },
    warnings,
  };
}

/**
 * Article media replay only: same downconversion as the default path, but
 * `resolveImageBlock` gets a chance to turn a source image block into a
 * real `MediaAsset`-backed `{type: "image", mediaId, alt, caption}` block
 * instead of it being dropped. An image `resolveImageBlock` declines (e.g.
 * an attachment outside the replay's allowlist) is dropped with the exact
 * same warning the default path produces — never silently different
 * behavior depending on why it wasn't resolved.
 */
export function normalizedContentToArticleContentJsonWithMedia(
  result: ContentNormalizationResult,
  resolveImageBlock: (block: Extract<NormalizedContentBlock, { type: "image" }>) => ResolvedArticleImageBlock | null,
): { contentJson: ArticleContentPayload; warnings: ContentNormalizationWarning[] } {
  const warnings = [...result.warnings];
  const blocks = convertBlocks(result.blocks, resolveImageBlock, warnings);
  return {
    contentJson: {
      version: ARTICLE_CONTENT_VERSION,
      blocks,
    },
    warnings,
  };
}
