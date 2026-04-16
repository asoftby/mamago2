/** Извлечь URL соцсетей и смежные контакты из rawPayload. */

type RawPayload = Record<string, unknown>;

export function extractFirstPhoneFromRawPayload(raw: RawPayload): string | undefined {
  const phonesRaw = raw["phone"] ?? raw["phones"] ?? raw["tel"];
  if (typeof phonesRaw === "string" && phonesRaw.trim()) return phonesRaw.trim();
  if (Array.isArray(phonesRaw) && typeof phonesRaw[0] === "string" && phonesRaw[0].trim()) {
    return phonesRaw[0].trim();
  }
  return undefined;
}

export function extractFirstWebsiteFromRawPayload(raw: RawPayload): string | undefined {
  const w = raw["website"] ?? raw["site"];
  if (typeof w === "string" && w.trim()) return w.trim();
  const arr = raw["websites"];
  if (Array.isArray(arr) && typeof arr[0] === "string" && arr[0].trim()) return arr[0].trim();
  const url = raw["url"];
  if (typeof url === "string" && url.trim() && /^https?:\/\//i.test(url.trim())) return url.trim();
  return undefined;
}

export function extractSocialUrlsFromRawPayload(raw: RawPayload): string[] {
  const direct = raw["socialUrls"];
  if (Array.isArray(direct)) {
    const strings = direct
      .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      .map((u) => u.trim());
    return [...new Set(strings)];
  }
  const links = raw["socialLinks"];
  if (!Array.isArray(links)) return [];
  const out: string[] = [];
  for (const item of links) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === "object" && "url" in item) {
      const u = (item as { url?: unknown }).url;
      if (typeof u === "string" && u.trim()) out.push(u.trim());
    }
  }
  return [...new Set(out)];
}
