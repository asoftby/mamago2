/**
 * Разбор HTML страницы `t.me/s/<канал>` в посты. Чистые функции, без сети.
 *
 * На веб-превью альбом приходит одним сообщением с несколькими фото, поэтому
 * склейка не нужна. Опросы и репосты отдаются со своими CSS-классами, а часть
 * сообщений (например, опросы) Telegram на превью может не показывать вовсе.
 */

export interface TelegramPostLink {
  text: string;
  href: string;
}

export interface TelegramPostFlags {
  poll: boolean;
  forwarded: boolean;
  advertisement: boolean;
  video: boolean;
}

export interface TelegramPost {
  channel: string;
  messageId: number;
  url: string;
  /** ISO-время публикации из `<time datetime>`, если есть */
  postedAt: string | null;
  text: string;
  links: TelegramPostLink[];
  hashtags: string[];
  imageUrls: string[];
  flags: TelegramPostFlags;
}

// JS `\b` знает только ASCII-слова даже с флагом `u`, поэтому границы заданы явно.
const ADVERTISEMENT_MARKER = /(?<![\p{L}\p{N}_])#?(?:реклама|erid)(?![\p{L}\p{N}_])/iu;

const MESSAGE_SPLIT = '<div class="tgme_widget_message_wrap';

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Содержимое первого `<div class="...cls...">` с учётом вложенных div. */
function extractDivContent(html: string, className: string): string | null {
  const open = new RegExp(`<div[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`).exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  let depth = 1;
  const tag = /<(\/?)div\b[^>]*>/g;
  tag.lastIndex = start;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index);
  }
  return null;
}

function htmlToText(fragment: string): string {
  return decodeHtmlEntities(
    fragment
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractLinks(fragment: string): TelegramPostLink[] {
  const links: TelegramPostLink[] = [];
  const re = /<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (let m = re.exec(fragment); m; m = re.exec(fragment)) {
    const href = decodeHtmlEntities(m[1]).trim();
    if (!/^https?:\/\//i.test(href)) continue;
    // Ссылки-хэштеги (`?q=%23...`) дублируют `hashtags`, в ссылки не берём.
    if (/[?&]q=%23/i.test(href)) continue;
    links.push({ text: htmlToText(m[2]), href });
  }
  return links;
}

function extractHashtags(text: string): string[] {
  const tags = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(tags.map((tag) => tag.toLowerCase()))];
}

function extractPhotoUrls(messageHtml: string): string[] {
  const urls: string[] = [];
  const re = /<a\b[^>]*class="[^"]*tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)/gi;
  for (let m = re.exec(messageHtml); m; m = re.exec(messageHtml)) {
    const url = decodeHtmlEntities(m[1]).trim();
    if (url.startsWith("https://") && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

export function parseChannelPage(html: string, channel: string): TelegramPost[] {
  const posts: TelegramPost[] = [];
  for (const block of html.split(MESSAGE_SPLIT).slice(1)) {
    const post = new RegExp(`data-post="${channel}/(\\d+)"`, "i").exec(block);
    if (!post) continue;
    const messageId = parseInt(post[1], 10);

    const textHtml = extractDivContent(block, "tgme_widget_message_text") ?? "";
    const text = htmlToText(textHtml);
    const time = /<time[^>]*\bdatetime="([^"]+)"/i.exec(block);

    posts.push({
      channel,
      messageId,
      url: `https://t.me/${channel}/${messageId}`,
      postedAt: time ? time[1] : null,
      text,
      links: extractLinks(textHtml),
      hashtags: extractHashtags(text),
      imageUrls: extractPhotoUrls(block),
      flags: {
        poll: block.includes("tgme_widget_message_poll"),
        forwarded: block.includes("tgme_widget_message_forwarded_from"),
        advertisement: ADVERTISEMENT_MARKER.test(text),
        video: block.includes("tgme_widget_message_video"),
      },
    });
  }
  return posts;
}
