import type { EventCategoryPublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";

// Pure UI helper lives in a separate file so client components can import it
// without pulling in the prisma dependency.
export { orderEventCategoriesForDisplay } from "./eventCategoryOrder";

/** Родитель для новой/переносимой дочерней записи: только существующий корень. */
export async function assertValidParentIdOrNull(
  parentId: string | null,
  opts?: { childType?: EventCategoryPublicationType },
): Promise<void> {
  if (parentId == null) return;
  const parent = await prisma.eventCategory.findUnique({
    where: { id: parentId },
    select: { parentId: true, publicationType: true },
  });
  if (!parent) {
    throw new Error("Parent not found");
  }
  if (parent.parentId != null) {
    throw new Error("Only a root category can be a parent");
  }
  if (opts?.childType != null && parent.publicationType !== opts.childType) {
    throw new Error("Parent category type must match child type");
  }
}

/** Нельзя сделать подкатегорией узел, у которого уже есть дети (иначе уровень > 2). */
export async function assertCanBecomeChild(categoryId: string): Promise<void> {
  const n = await prisma.eventCategory.count({
    where: { parentId: categoryId },
  });
  if (n > 0) {
    throw new Error("Remove or move subcategories first");
  }
}
