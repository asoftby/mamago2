import prisma from "@/lib/prisma";

export async function getDistricts(cityId: string) {
  return prisma.district.findMany({
    where: { cityId },
    orderBy: { name: "asc" },
  });
}
