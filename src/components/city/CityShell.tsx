import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { CityDiscoveryShell } from "./CityDiscoveryShell";
import { Intent } from "@/lib/intent";
import { listPublicRoutesByCity } from "@/server/services/route.service";
import { MOCK_ROUTES } from "@/mocks/routes.mock";
import { getCurrentUser } from "@/lib/auth/server";
import { getKudaDiscoveryFeed } from "@/server/discovery/kudaDiscoveryFeed";

interface CityShellProps {
  citySlug: string;
  intent: Intent;
  searchParams: Record<string, string | string[] | undefined>;
}

export async function CityShell({ citySlug, intent, searchParams }: CityShellProps) {
  const [city, user] = await Promise.all([
    prisma.city.findUnique({ where: { slug: citySlug } }),
    getCurrentUser(),
  ]);
  if (!city) notFound();

  let discoveryActivities = undefined;
  if (intent === "kuda" || intent === "birthday") {
    discoveryActivities = await getKudaDiscoveryFeed(city.id, city.slug, user?.id ?? null);
  }

  // For routes intent, load routes data server-side
  let routesData = undefined;
  if (intent === "routes") {
    const dbRoutes = await listPublicRoutesByCity(city.id).catch(() => []);
    const realRoutes = dbRoutes.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      ageTags: r.ageTags,
      budgetLevel: r.budgetLevel,
      cityName: r.city?.name ?? city.name,
      coverImageUrl:
        r.coverImageUrl ??
        r.stops.find((s) => s.photoUrl)?.photoUrl ??
        "https://images.unsplash.com/photo-1513884923967-4b182ef1671f?q=80&w=1200",
      authorName: r.author?.email?.split("@")[0] ?? null,
      isEditorial: r.authorId === null,
      stopsCount: r.stops.length,
      stops: r.stops.map((s) => ({
        id: s.id,
        order: s.order,
        address: s.place?.title ?? s.customTitle ?? s.address ?? "",
        note: s.note,
        photoUrl: s.photoUrl ?? "",
        lat: s.lat ?? undefined,
        lng: s.lng ?? undefined,
      })),
    }));

    // Merge DB routes with mock fallback (no duplicates by slug)
    const mockForCity = MOCK_ROUTES.filter(
      (r) => r.cityName.toLowerCase() === city.name.toLowerCase()
    );
    routesData = [
      ...realRoutes,
      ...mockForCity.filter((m) => !realRoutes.some((r) => r.slug === m.slug)),
    ];
  }

  return (
    <CityDiscoveryShell
      city={citySlug}
      intent={intent}
      routesData={routesData}
      discoveryActivities={discoveryActivities}
    />
  );
}
