"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteActions } from "@/features/me/components/RouteActions";
import { formatAgeKeysShort } from "@/lib/config/ages";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

type UserRoute = {
  id: string;
  slug: string;
  title: string;
  ageTags: string[];
  budgetLevel: string;
  status: string;
  stopsCount: number;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type RoutesClientProps = {
  initialRoutes: UserRoute[];
};

const BUDGET_LABELS: Record<string, string> = {
  FREE: "Бесплатно",
  LOW: "до 50 BYN",
  MEDIUM: "50–150 BYN",
  HIGH: "150+ BYN",
};

function RouteCard({ route }: { route: UserRoute }) {
  const isDraft = route.status === "DRAFT";
  const budgetLabel = BUDGET_LABELS[route.budgetLevel] || route.budgetLevel;
  const ageLabel = formatAgeKeysShort(route.ageTags);

  return (
    <div className="group relative bg-white rounded-2xl border border-neutral-200 overflow-hidden hover:shadow-lg transition-all">
      <Link href={`/routes/${route.slug}`} className="block">
        {/* Cover Image */}
        {route.coverImageUrl ? (
          <div className="aspect-[16/9] overflow-hidden bg-neutral-100">
            <img
              src={route.coverImageUrl}
              alt={route.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
            <MapPin className="w-12 h-12 text-neutral-400" />
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-2">
          {/* Status Badge */}
          {isDraft && (
            <div className="inline-flex">
              <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                Черновик
              </span>
            </div>
          )}

          {/* Title */}
          <h3 className="font-bold text-neutral-900 leading-snug line-clamp-2">
            {route.title}
          </h3>

          {/* Meta */}
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <span>{route.stopsCount} {route.stopsCount === 1 ? "точка" : route.stopsCount < 5 ? "точки" : "точек"}</span>
            <span>·</span>
            <span>{budgetLabel}</span>
            {ageLabel && (
              <>
                <span>·</span>
                <span>{ageLabel}</span>
              </>
            )}
          </div>

          {/* Date */}
          <p className="text-xs text-neutral-400">
            Обновлено {format(parseISO(route.updatedAt), "d MMMM yyyy", { locale: ru })}
          </p>
        </div>
      </Link>

      {/* Actions */}
      <div className="absolute top-3 right-3">
        <RouteActions
          routeId={route.id}
          routeSlug={route.slug}
          routeTitle={route.title}
        />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mb-6">
        <MapPin className="w-10 h-10 text-neutral-400" />
      </div>
      <h3 className="text-xl font-bold text-neutral-900 mb-2">
        У вас пока нет маршрутов
      </h3>
      <p className="text-neutral-500 mb-8 max-w-md">
        Создайте свой первый маршрут с интересными местами для прогулок с детьми
      </p>
      <Link href="/routes/new">
        <Button size="lg" className="rounded-2xl font-semibold">
          <Plus className="w-5 h-5 mr-2" />
          Создать маршрут
        </Button>
      </Link>
    </div>
  );
}

export function RoutesClient({ initialRoutes }: RoutesClientProps) {
  const [routes] = useState<UserRoute[]>(initialRoutes);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Мои маршруты</h1>
          <p className="text-neutral-500 mt-1">
            {routes.length === 0
              ? "Создавайте и сохраняйте свои любимые маршруты"
              : `${routes.length} ${routes.length === 1 ? "маршрут" : routes.length < 5 ? "маршрута" : "маршрутов"}`}
          </p>
        </div>
        {routes.length > 0 && (
          <Link href="/routes/new">
            <Button size="lg" className="rounded-2xl font-semibold">
              <Plus className="w-5 h-5 mr-2" />
              Создать
            </Button>
          </Link>
        )}
      </div>

      {/* Routes Grid */}
      {routes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {routes.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
