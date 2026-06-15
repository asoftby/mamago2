import prisma from "@/lib/prisma";

export type NearbyCity = {
  id: string;
  slug: string;
  name: string;
  distanceKm: number;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

export async function listNearbyCities(
  city: {
    id: string;
    centerLat: number | null;
    centerLng: number | null;
    lat: number | null;
    lng: number | null;
  },
  options?: { take?: number },
): Promise<NearbyCity[]> {
  const sourceLat = city.centerLat ?? city.lat;
  const sourceLng = city.centerLng ?? city.lng;
  if (sourceLat == null || sourceLng == null) return [];

  const rows = await prisma.city.findMany({
    where: {
      id: { not: city.id },
      isActive: true,
      isLegacyNonCity: false,
      centerLat: { not: null },
      centerLng: { not: null },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      centerLat: true,
      centerLng: true,
    },
  });

  return rows
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      distanceKm: haversineKm(sourceLat, sourceLng, row.centerLat ?? sourceLat, row.centerLng ?? sourceLng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, options?.take ?? 3);
}
