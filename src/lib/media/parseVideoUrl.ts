export type ParsedVideoUrl =
  | { type: "instagram"; url: string; embedId: string; label: "Reels" | "Post" }
  | { type: "youtube"; url: string; embedId: string; label: "YouTube" };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,}$/;

/** Parse only the video providers supported by publication galleries. */
export function parseVideoUrl(value: string | null | undefined): ParsedVideoUrl | null {
  const input = value?.trim();
  if (!input) return null;

  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (host === "instagram.com" && (parts[0] === "reel" || parts[0] === "p") && parts[1]) {
      return {
        type: "instagram",
        url: parsed.toString(),
        embedId: parts[1],
        label: parts[0] === "p" ? "Post" : "Reels",
      };
    }

    let youtubeId: string | null = null;
    if (host === "youtu.be") youtubeId = parts[0] ?? null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parts[0] === "watch") youtubeId = parsed.searchParams.get("v");
      if (parts[0] === "shorts" || parts[0] === "embed") youtubeId = parts[1] ?? null;
    }
    if (youtubeId && YOUTUBE_ID.test(youtubeId)) {
      return { type: "youtube", url: parsed.toString(), embedId: youtubeId, label: "YouTube" };
    }
  } catch {
    return null;
  }

  return null;
}
