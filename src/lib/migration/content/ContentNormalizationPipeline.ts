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
  | { type: "image"; src: string; alt?: string };

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

function normalizeAnchors(html: string, warnings: ContentNormalizationWarning[]): string {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_full, attrs: string, body: string) => {
    const text = stripHtmlTags(body);
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
  const mediaBlocks = extractMediaBlocks(cleanedHtml, warnings);
  const htmlWithoutImages = cleanedHtml.replace(/<img\b[^>]*>/gi, "\n");
  const textBlocks = linesToBlocks(htmlToLogicalLines(htmlWithoutImages));
  const blocks = [...textBlocks, ...mediaBlocks];
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

export function normalizedContentToArticleContentJson(
  result: ContentNormalizationResult,
): { contentJson: ArticleContentPayload; warnings: ContentNormalizationWarning[] } {
  const warnings = [...result.warnings];
  const blocks: ArticleBlockMvp[] = [];
  let hasIntro = false;

  result.blocks.forEach((block) => {
    const id = articleBlockId(blocks.length);
    if (block.type === "paragraph") {
      blocks.push({ id, type: hasIntro ? "text" : "intro", text: block.text });
      hasIntro = true;
      return;
    }
    if (block.type === "heading") {
      blocks.push({ id, type: "heading", level: block.level, text: block.text });
      return;
    }
    if (block.type === "image") {
      warnings.push({
        code: "UNSUPPORTED_ARTICLE_BLOCK_DOWNCONVERTED",
        message: "Image block was not written because article migration media import is outside the current safe MVP scope.",
        details: { src: block.src },
      });
      return;
    }
    if (block.type === "link") {
      blocks.push({ id, type: "text", text: `${block.text}: ${block.href}` });
      return;
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
  });

  return {
    contentJson: {
      version: ARTICLE_CONTENT_VERSION,
      blocks,
    },
    warnings,
  };
}
