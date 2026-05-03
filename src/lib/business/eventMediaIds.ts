import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { isMediaAssetCuid } from "@/lib/media/isMediaAssetCuid";

export { isMediaAssetCuid } from "@/lib/media/isMediaAssetCuid";

export async function resolveCoverImageId(
  input: string | null | undefined,
): Promise<string | null> {
  if (input == null || input === "") return null;
  if (isMediaAssetCuid(input)) return input;

  const byFilename = await prisma.mediaAsset.findFirst({
    where: {
      OR: [{ filename: input }, { publicUrl: { endsWith: `/${input}` } }],
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return byFilename?.id ?? null;
}

/**
 * Приводит значения из формы (cuid, имя файла, publicUrl) к упорядоченному списку MediaAsset.id.
 */
export async function resolveEventGalleryMediaIds(raw: string[]): Promise<string[]> {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of raw.filter(isMediaAssetCuid)) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  const legacy = raw.filter((x) => !isMediaAssetCuid(x)).filter(Boolean);
  if (legacy.length === 0) return result;

  const or: Prisma.MediaAssetWhereInput[] = [];
  for (const e of legacy) {
    or.push({ filename: e });
    if (
      e.startsWith("/uploads/") ||
      e.startsWith("/api/media/file/") ||
      e.startsWith("http://") ||
      e.startsWith("https://")
    ) {
      or.push({ publicUrl: e });
    } else if (!e.includes("/")) {
      or.push({ publicUrl: `/uploads/${e}` });
      or.push({ publicUrl: `/api/media/file/${e}` });
    }
  }

  const found =
    or.length > 0
      ? await prisma.mediaAsset.findMany({
          where: { OR: or, status: "ACTIVE" },
          select: { id: true, filename: true, publicUrl: true },
        })
      : [];

  const matchLegacy = (e: string): string | null => {
    for (const row of found) {
      if (row.filename === e) return row.id;
      if (row.publicUrl === e) return row.id;
      if (!e.includes("/") && row.publicUrl?.endsWith(`/${e}`)) return row.id;
    }
    return null;
  };

  for (const e of legacy) {
    const id = matchLegacy(e);
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
}
