import { notFound } from "next/navigation";
import { MOCK_ROUTES, BUDGET_LABELS } from "@/mocks/routes.mock";
import { formatAgeKeysShort } from "@/lib/config/ages";
import { getRouteBySlug, type RouteWithStops } from "@/server/services/route.service";
import { RouteDetailClient } from "./RouteDetailClient";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

/** Build a human-readable address line: "Город, улица, дом" */
function buildStopAddress(
  place: RouteWithStops["stops"][0]["place"],
  fallback: string | null
): string {
  if (!place) return fallback ?? "";
  const parts: string[] = [];
  if (place.city?.name) parts.push(place.city.name);
  if (place.shortAddress) parts.push(place.shortAddress);
  else if (place.formattedAddr) parts.push(place.formattedAddr);
  return parts.join(", ") || fallback || "";
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const mock = MOCK_ROUTES.find((r) => r.slug === slug);
  if (mock) {
    return {
      title: `${mock.title} — маршрут в ${mock.cityName} | mamaGo`,
      description: `${mock.stopsCount} точки · ${BUDGET_LABELS[mock.budgetLevel]} · ${formatAgeKeysShort(mock.ageTags)}`,
    };
  }
  const db = await getRouteBySlug(slug).catch(() => null);
  if (!db) return {};
  return {
    title: `${db.title} — маршрут | mamaGo`,
    description: `${db.stops.length} точки · ${BUDGET_LABELS[db.budgetLevel as keyof typeof BUDGET_LABELS] ?? ""}`,
  };
}

export default async function RouteDetailPage({ params }: Props) {
  const { slug } = await params;

  // Try mock first
  const mock = MOCK_ROUTES.find((r) => r.slug === slug);
  if (mock) return <RouteDetailClient route={mock} />;

  // Try DB
  const db = await getRouteBySlug(slug).catch(() => null);
  if (!db) notFound();

  const route = {
    id: db.id,
    slug: db.slug,
    title: db.title,
    ageTags: db.ageTags,
    budgetLevel: db.budgetLevel,
    cityName: db.city?.name ?? "Минск",
    coverImageUrl:
      db.coverImageUrl ??
      db.stops.find((s) => s.photoUrl)?.photoUrl ??
      "https://images.unsplash.com/photo-1513884923967-4b182ef1671f?q=80&w=1200",
    authorName: db.author?.email?.split("@")[0] ?? null,
    isEditorial: db.authorId === null,
    stopsCount: db.stops.length,
    stops: db.stops.map((s) => ({
      id: s.id,
      order: s.order,
      title: s.place?.title ?? s.customTitle ?? undefined,
      address: buildStopAddress(s.place, s.address),
      note: s.note,
      photoUrl: s.photoUrl ?? "",
      lat: s.lat ?? undefined,
      lng: s.lng ?? undefined,
    })),
  };

  return <RouteDetailClient route={route} />;
}
