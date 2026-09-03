import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getAdminMediaList } from "@/server/services/media/media-query.service";
import { getMediaStats } from "@/server/services/media/media.service";
import { Image as ImageIcon, AlertCircle, Archive, Trash2, HardDrive } from "lucide-react";
import { AdminMediaUploader } from "@/components/admin/media/AdminMediaUploader";
import { AdminMediaTableClient } from "@/components/admin/media/AdminMediaTableClient";
import { MediaStatusFilter } from "@/components/admin/media/MediaStatusFilter";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { parseAdminPage } from "@/lib/admin/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Force dynamic rendering to avoid caching issues
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const params = await searchParams;
  const statusFilter = params.status || "active";
  const page = parseAdminPage(params.page);
  const search = params.q?.trim() || undefined;

  // Determine which statuses to show
  let statusesToShow: string[];
  if (statusFilter === "archived") {
    statusesToShow = ["ARCHIVED"];
  } else if (statusFilter === "all") {
    statusesToShow = ["ACTIVE", "ARCHIVED"];
  } else {
    statusesToShow = ["ACTIVE"];
  }

  const [mediaList, stats] = await Promise.all([
    getAdminMediaList({ status: statusesToShow, search }, { page, limit: 50 }),
    getMediaStats(),
  ]);

  const { limit, total, totalPages } = mediaList.pagination;
  const start = total === 0 ? 0 : (mediaList.pagination.page - 1) * limit + 1;
  const end = total === 0 ? 0 : Math.min(mediaList.pagination.page * limit, total);
  const resetHref =
    statusFilter === "active" ? "/admin/media" : `/admin/media?status=${encodeURIComponent(statusFilter)}`;

  return (
    <div className="p-6 md:p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Медиатека</h1>
          <p className="text-sm text-gray-600 mt-1">Все медиафайлы платформы</p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="h-11 w-full max-w-md rounded-xl bg-muted/40 animate-pulse" aria-hidden />
        }
      >
        <MediaStatusFilter />
      </Suspense>

      <form action="/admin/media" className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-end">
        {statusFilter !== "active" ? (
          <input type="hidden" name="status" value={statusFilter} />
        ) : null}
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="media-search">
            Поиск
          </label>
          <Input
            id="media-search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Имя файла или storage key"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="h-10">
            Найти
          </Button>
          {search ? (
            <Button type="button" variant="ghost" className="h-10" asChild>
              <Link href={resetHref}>Сбросить</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-gray-600" />
            <p className="text-sm text-gray-600">Всего</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className="w-4 h-4 text-green-600" />
            <p className="text-sm text-gray-600">Активные</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.byStatus.active}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-gray-600" />
            <p className="text-sm text-gray-600">Неиспользуемые</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.byStatus.orphaned}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Archive className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-gray-600">Архив</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.byStatus.archived}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 className="w-4 h-4 text-red-600" />
            <p className="text-sm text-gray-600">Удаленные</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.byStatus.deleted}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <p className="text-sm text-gray-600">Заблокированные</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.byStatus.blocked}</p>
        </div>
      </div>

      {/* Upload Section */}
      <AdminMediaUploader />

      {/* Media Table */}
      <AdminMediaTableClient items={mediaList.items} />

      {/* Pagination */}
      <AdminPagination
        page={mediaList.pagination.page}
        totalPages={totalPages}
        total={total}
        start={start}
        end={end}
        basePath="/admin/media"
        params={params}
      />
    </div>
  );
}
