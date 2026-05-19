import { Container } from "@/components/ui/Container";
import { RouteCard } from "@/components/routes/RouteCard";
import { listPublicRoutes } from "@/server/services/route.service";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { PublicRouteCardModel } from "@/components/routes/types";

export const metadata = {
  title: "Маршруты — mamaGo",
  description: "Готовые семейные маршруты по городу. Сохраняйте, делитесь, добавляйте в план.",
};

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const dbRoutes = await listPublicRoutes().catch(() => []);

  const routes: PublicRouteCardModel[] = dbRoutes.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    ageTags: r.ageTags,
    budgetLevel: r.budgetLevel,
    cityName: r.city?.name ?? "Минск",
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

  return (
    <div className="min-h-screen bg-[#F8F8F7]">
      <Container className="py-8 pb-20">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 leading-tight">Маршруты</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Готовые сценарии семейного дня — от mamaGo и других родителей
            </p>
          </div>
          <Link
            href="/routes/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Создать
          </Link>
        </div>

        {routes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
            Пока нет опубликованных маршрутов.
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
            {routes.map((route) => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
