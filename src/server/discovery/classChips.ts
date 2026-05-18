import { prismaBase } from "@/lib/prisma";

export type DiscoveryClassChipRecord = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  isSystem: boolean;
  entityType: string;
  surfaceKey: string;
  signalDefinitionId: string | null;
};

export async function listDiscoveryClassChips(options?: {
  includeInactive?: boolean;
}): Promise<DiscoveryClassChipRecord[]> {
  const includeInactive = options?.includeInactive ?? false;
  try {
    return await prismaBase.discoveryClassChip.findMany({
      where: {
        surfaceKey: "CLASSES",
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
  } catch (err) {
    // Таблица ещё не создана (миграция не применена) — возвращаем пустой массив
    // чтобы страница не падала в runtime
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("P2021")) {
      console.warn("[classChips] DiscoveryClassChip table not found, returning empty list");
      return [];
    }
    throw err;
  }
}

export function resolveDiscoveryClassChipSlug(
  requestedSlug: string | null | undefined,
  chips: Array<Pick<DiscoveryClassChipRecord, "slug" | "isActive" | "isDefault">>,
): string {
  const normalized = (requestedSlug ?? "").trim().toLowerCase();
  if (normalized) {
    const exact = chips.find((chip) => chip.slug === normalized && chip.isActive);
    if (exact) return exact.slug;
  }

  const defaultChip = chips.find((chip) => chip.isDefault && chip.isActive);
  if (defaultChip) return defaultChip.slug;

  return "all";
}
