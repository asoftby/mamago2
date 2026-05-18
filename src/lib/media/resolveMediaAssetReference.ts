import path from "path";
import prisma from "@/lib/prisma";

type MediaAssetRef = {
  id: string;
  publicUrl: string | null;
  filename: string;
  originalName: string;
  storageKey: string;
};

function normalizeRef(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function basenameFromRef(value: string): string | null {
  try {
    if (/^https?:\/\//i.test(value)) {
      const parsed = new URL(value);
      const base = path.posix.basename(parsed.pathname);
      return base || null;
    }
  } catch {
    // Ignore URL parse failures and keep fallback basename handling below.
  }

  const withoutQuery = value.split("?")[0]?.split("#")[0] ?? value;
  const base = path.posix.basename(withoutQuery);
  return base && base !== "." && base !== "/" ? base : null;
}

async function findByExactRef(ref: string): Promise<MediaAssetRef | null> {
  return prisma.mediaAsset.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { id: ref },
        { publicUrl: ref },
        { storageKey: ref },
        { filename: ref },
        { originalName: ref },
      ],
    },
    select: {
      id: true,
      publicUrl: true,
      filename: true,
      originalName: true,
      storageKey: true,
    },
  });
}

async function findByBasename(base: string): Promise<MediaAssetRef | null> {
  return prisma.mediaAsset.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { filename: base },
        { originalName: base },
        { publicUrl: { endsWith: `/${base}` } },
        { storageKey: { endsWith: `/${base}` } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      publicUrl: true,
      filename: true,
      originalName: true,
      storageKey: true,
    },
  });
}

export async function findMediaAssetByReference(
  value: string | null | undefined,
): Promise<MediaAssetRef | null> {
  const ref = normalizeRef(value);
  if (!ref) return null;

  const exact = await findByExactRef(ref);
  if (exact) return exact;

  const base = basenameFromRef(ref);
  if (!base || base === ref) return null;

  return findByBasename(base);
}

export async function resolveMediaAssetReferences(
  refs: Array<string | null | undefined>,
): Promise<
  Array<{
    ref: string;
    asset: MediaAssetRef | null;
  }>
> {
  const unique = [...new Set(refs.map((ref) => normalizeRef(ref)).filter(Boolean))] as string[];

  const resolved = await Promise.all(
    unique.map(async (ref) => ({
      ref,
      asset: await findMediaAssetByReference(ref),
    })),
  );

  return resolved;
}

export function normalizeMediaDisplayUrl(
  value: string | null | undefined,
): string | null {
  const ref = normalizeRef(value);
  if (!ref) return null;

  if (/^https?:\/\//i.test(ref)) return ref;
  if (ref.startsWith("/")) return ref;
  if (ref.startsWith("uploads/")) return `/${ref}`;
  return null;
}
