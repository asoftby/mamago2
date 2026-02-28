import prisma from "@/lib/prisma";

export async function normalizeFilterOptionOrder(filterId: string) {
  // 1. Fetch all options for this filter, ordered by current orderIndex or id
  const options = await prisma.filterOption.findMany({
    where: { filterId },
    orderBy: [
      { orderIndex: "asc" },
      { id: "asc" } // Fallback to id if orderIndex is same (e.g. all 0)
    ],
  });

  // 2. Update each option with a clean 0..N-1 index
  // We use a transaction to ensure consistency
  await prisma.$transaction(
    options.map((option, index) =>
      prisma.filterOption.update({
        where: { id: option.id },
        data: { orderIndex: index },
      })
    )
  );

  return options.length;
}
