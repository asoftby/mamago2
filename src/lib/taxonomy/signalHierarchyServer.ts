import prisma from "@/lib/prisma";

export async function assertValidSignalParentIdOrNull(
  parentId: string | null,
): Promise<void> {
  if (parentId == null) return;
  const parent = await prisma.signalDefinition.findUnique({
    where: { id: parentId },
    select: { parentId: true },
  });
  if (!parent) {
    throw new Error("Parent not found");
  }
  if (parent.parentId != null) {
    throw new Error("Only a root signal can be a parent");
  }
}

export async function assertSignalCanBecomeChild(definitionId: string): Promise<void> {
  const n = await prisma.signalDefinition.count({
    where: { parentId: definitionId },
  });
  if (n > 0) {
    throw new Error("Remove or move sub-signals first");
  }
}
