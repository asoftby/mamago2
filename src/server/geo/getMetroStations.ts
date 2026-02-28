import prisma from "@/lib/prisma";

export async function getMetroStations(cityId: string) {
  return prisma.metroStation.findMany({
    where: { cityId },
    orderBy: { name: "asc" },
  });
}
