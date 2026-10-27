import prisma from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";
import { buildMediaFilePublicUrl, extractMediaRelativePathFromUrl } from "@/lib/media/mediaUrlBuilder";

export type StoredImageDimensions = { width: number; height: number };

type DimensionsDb = { mediaAsset: Pick<PrismaClient["mediaAsset"], "findMany"> };

/** Media proxy route that resolves `/api/media/<mediaId | filename>` (see app/api/media/[filename]). */
const MEDIA_PROXY_PREFIX = "/api/media/";

/** How one cover URL can be matched to a MediaAsset row. */
export type CoverUrlKeys = {
  /** Exact storage URLs (storageKey/publicUrl), incl. the canonical `/api/media/file/...` form. */
  urls: string[];
  /** `/api/media/<ref>` proxy reference: MediaAsset id or filename. */
  proxyRef: string | null;
};

function pathOf(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
  return url.split("?")[0]!.split("#")[0]!;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Normalizes a resolved cover URL into lookup keys. Mirrors what
 * `resolveActivityCoverUrl` emits: canonical `/api/media/file/<path>` URLs
 * (absolute or relative), legacy `/uploads/...` URLs and `/api/media/<ref>`
 * proxy links where `<ref>` is a MediaAsset id or filename.
 */
export function coverUrlLookupKeys(raw: string): CoverUrlKeys {
  const url = raw.trim();
  const urls = new Set<string>([url]);
  const path = pathOf(url);
  urls.add(path);

  const relative = extractMediaRelativePathFromUrl(url);
  if (relative) {
    urls.add(buildMediaFilePublicUrl(safeDecode(relative)));
    return { urls: [...urls], proxyRef: null };
  }

  if (path.startsWith(MEDIA_PROXY_PREFIX)) {
    const ref = safeDecode(path.slice(MEDIA_PROXY_PREFIX.length));
    if (ref && !ref.includes("/")) return { urls: [...urls], proxyRef: ref };
  }
  return { urls: [...urls], proxyRef: null };
}

/**
 * Batch-resolve stored image dimensions for already-resolved cover URLs.
 *
 * Matches, in one query: exact/canonical storage URLs (`storageKey`, unique
 * index; `publicUrl`) — covers imports that only keep `coverImageUrl` — and
 * `/api/media/<id | filename>` proxy links by MediaAsset `id` / `filename`.
 * The returned map is keyed by the input URLs as given. Unknown URLs are
 * absent — the card then falls back to the "unknown dimensions" ratio.
 */
export async function loadImageDimensionsByUrl(
  urls: ReadonlyArray<string | null | undefined>,
  db: DimensionsDb = prisma,
): Promise<Map<string, StoredImageDimensions>> {
  const inputs = [...new Set(urls.map((url) => url?.trim()).filter((url): url is string => Boolean(url)))];
  const out = new Map<string, StoredImageDimensions>();
  if (inputs.length === 0) return out;

  const keysByInput = new Map(inputs.map((input) => [input, coverUrlLookupKeys(input)]));
  const storageUrls = [...new Set([...keysByInput.values()].flatMap((keys) => keys.urls))];
  const proxyRefs = [...new Set([...keysByInput.values()].map((keys) => keys.proxyRef).filter((ref): ref is string => Boolean(ref)))];

  const rows = await db.mediaAsset.findMany({
    where: {
      deletedAt: null,
      width: { not: null },
      height: { not: null },
      OR: [
        { storageKey: { in: storageUrls } },
        { publicUrl: { in: storageUrls } },
        ...(proxyRefs.length > 0 ? [{ id: { in: proxyRefs } }, { filename: { in: proxyRefs } }] : []),
      ],
    },
    select: { id: true, filename: true, storageKey: true, publicUrl: true, width: true, height: true },
  });

  const byUrl = new Map<string, StoredImageDimensions>();
  const byId = new Map<string, StoredImageDimensions>();
  const byFilename = new Map<string, StoredImageDimensions>();
  for (const row of rows) {
    if (!row.width || !row.height || row.width <= 0 || row.height <= 0) continue;
    const dims = { width: row.width, height: row.height };
    byUrl.set(row.storageKey, dims);
    if (row.publicUrl) byUrl.set(row.publicUrl, dims);
    byId.set(row.id, dims);
    if (!byFilename.has(row.filename)) byFilename.set(row.filename, dims);
  }

  for (const [input, keys] of keysByInput) {
    const fromUrl = keys.urls.map((url) => byUrl.get(url)).find(Boolean);
    const fromProxy = keys.proxyRef ? byId.get(keys.proxyRef) ?? byFilename.get(keys.proxyRef) : undefined;
    const dims = fromUrl ?? fromProxy;
    if (dims) out.set(input, dims);
  }
  return out;
}

/** Attach `imageWidth`/`imageHeight` to listing DTOs by their resolved image URL. */
export async function withImageDimensions<T>(
  items: T[],
  getUrl: (item: T) => string | null | undefined,
  db?: DimensionsDb,
): Promise<Array<T & { imageWidth: number | null; imageHeight: number | null }>> {
  const dims = await loadImageDimensionsByUrl(items.map(getUrl), db);
  return items.map((item) => {
    const url = getUrl(item)?.trim();
    const found = url ? dims.get(url) : undefined;
    return { ...item, imageWidth: found?.width ?? null, imageHeight: found?.height ?? null };
  });
}
