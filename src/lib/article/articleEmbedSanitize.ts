export type ParsedArticleEmbed =
  | { provider: "youtube"; videoId: string; embedUrl: string }
  | { provider: "instagram"; url: string }
  | { provider: "external"; url: string }
  | null;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
]);
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);
const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{6,64}$/;

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getHtmlAttr(tag: string, name: string): string | null {
  const quoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  if (quoted) return decodeBasicEntities(quoted[2] ?? quoted[3] ?? "");
  const unquoted = tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, "i"));
  return unquoted ? decodeBasicEntities(unquoted[1]) : null;
}

function extractStoredValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["url", "src", "embedUrl", "embedHtml", "value"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return "";
}

function extractUrlCandidate(raw: string): string {
  const iframe = raw.match(/<iframe\b[^>]*>/i)?.[0];
  if (iframe) return getHtmlAttr(iframe, "src")?.trim() ?? "";
  const blockquote = raw.match(/<blockquote\b[\s\S]*?<\/blockquote>/i)?.[0];
  if (blockquote && /instagram-media/i.test(blockquote)) {
    return getHtmlAttr(blockquote, "data-instgrm-permalink")?.trim() ?? "";
  }
  return raw;
}

function youtubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  let candidate: string | null = null;

  if (host === "youtu.be") candidate = segments.length === 1 ? segments[0] : null;
  else if (segments[0] === "embed" || segments[0] === "shorts") {
    candidate = segments.length === 2 ? segments[1] : null;
  } else if (url.pathname === "/watch") candidate = url.searchParams.get("v");

  return candidate && YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

function instagramEmbedUrl(url: URL): string | null {
  if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (!["p", "reel", "tv"].includes(segments[0] ?? "") || segments.length < 2) return null;
  const shortcode = segments[1];
  if (!/^[a-zA-Z0-9_-]+$/.test(shortcode)) return null;
  return `https://www.instagram.com/${segments[0]}/${shortcode}/embed`;
}

/** Parses legacy HTML, ordinary URLs and normalized object values without trusting stored HTML. */
export function parseArticleEmbed(value: unknown): ParsedArticleEmbed {
  const raw = extractStoredValue(value);
  if (!raw) return null;
  try {
    const url = new URL(extractUrlCandidate(raw));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const videoId = youtubeVideoId(url);
    if (videoId) {
      return {
        provider: "youtube",
        videoId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      };
    }
    const instagramUrl = instagramEmbedUrl(url);
    if (instagramUrl) return { provider: "instagram", url: instagramUrl };
    return { provider: "external", url: url.href };
  } catch {
    return null;
  }
}
