import Link from "next/link";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAgeKeysShort } from "@/lib/config/ages";

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

type RoutesGridProps = {
  routes: UserRoute[];
  deletingRouteId: string | null;
  onDelete: (route: UserRoute) => void;
};

const BUDGET_LABELS: Record<string, string> = {
  FREE: "Бесплатно",
  LOW: "до 50 BYN",
  MEDIUM: "50–150 BYN",
  HIGH: "150+ BYN",
};

function pluralizeStops(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} точка`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} точки`;
  return `${n} точек`;
}

function RouteGridCard({
  route,
  isDeleting,
  onDelete,
}: {
  route: UserRoute;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  const isDraft = route.status === "DRAFT";
  const ageLabel = formatAgeKeysShort(route.ageTags);
  const budget = BUDGET_LABELS[route.budgetLevel] ?? route.budgetLevel;

  return (
    <div
      className={cn(
        "group relative w-full max-w-[230px] sm:max-w-[250px] transition-opacity",
        isDeleting && "opacity-50 pointer-events-none",
      )}
    >
      <div className="space-y-3">
        {/* Card image + badges */}
        <div className="relative">
          <Link href={`/routes/${route.slug}`} className="block">
            <div className="relative overflow-hidden rounded-[18px] aspect-square bg-neutral-100">
              {route.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={route.coverImageUrl}
                  alt={route.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <MapPin className="h-10 w-10 text-neutral-300" />
                </div>
              )}

              {isDraft && (
                <div className="absolute bottom-2.5 left-2.5">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                    Черновик
                  </span>
                </div>
              )}
            </div>
          </Link>

          {/* Action buttons — top right */}
          <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Link
              href={`/routes/${route.slug}/edit`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-neutral-500 shadow-sm backdrop-blur-sm transition-colors hover:text-neutral-900"
              title="Редактировать"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-neutral-500 shadow-sm backdrop-blur-sm transition-colors hover:text-red-600 disabled:opacity-50"
              title="Удалить"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Title + meta */}
        <div className="px-1">
          <Link href={`/routes/${route.slug}`} className="block">
            <p className="text-sm font-semibold leading-snug text-[#141210] line-clamp-2 transition-colors group-hover:text-[#EF8759]">
              {route.title}
            </p>
            <p className="mt-1 text-xs text-[rgba(20,18,16,0.5)] line-clamp-1">
              {[route.stopsCount > 0 ? pluralizeStops(route.stopsCount) : null, ageLabel, budget]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RoutesGrid({ routes, deletingRouteId, onDelete }: RoutesGridProps) {
  return (
    <div className="grid grid-cols-1 justify-items-center gap-x-4 gap-y-8 min-[560px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {routes.map((route) => (
        <RouteGridCard
          key={route.id}
          route={route}
          isDeleting={deletingRouteId === route.id}
          onDelete={() => onDelete(route)}
        />
      ))}
    </div>
  );
}
