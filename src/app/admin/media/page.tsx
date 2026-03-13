import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getAdminMediaList } from "@/server/services/media/media-query.service";
import { getMediaStats } from "@/server/services/media/media.service";
import { Image as ImageIcon, AlertCircle, Archive, Trash2, HardDrive } from "lucide-react";
import { MediaStatusBadge } from "@/components/admin/media/MediaStatusBadge";
import { MediaKindBadge } from "@/components/admin/media/MediaKindBadge";
import { MediaPreview } from "@/components/admin/media/MediaPreview";
import { AdminMediaUploader } from "@/components/admin/media/AdminMediaUploader";
import Link from "next/link";
import { formatDistance } from "date-fns";
import { ru } from "date-fns/locale";
import { formatBytes } from "@/lib/media/formatBytes";
import { resolveDisplayFilename } from "@/lib/media/resolveDisplayFilename";
import { resolveEffectiveMetadata } from "@/lib/media/generateMediaMetadata";

import { MediaStatusFilter } from "@/components/admin/media/MediaStatusFilter";

// Force dynamic rendering to avoid caching issues
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const params = await searchParams;
  const statusFilter = params.status || "active";

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
    getAdminMediaList({ status: statusesToShow }, { page: 1, limit: 50 }),
    getMediaStats(),
  ]);

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold">Медиатека</h1>
          <p className="text-sm text-gray-600 mt-1">Все медиафайлы платформы</p>
        </div>
        <MediaStatusFilter />
      </div>

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
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Превью
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Файл
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Тип
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Размер
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Использований
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Загружен
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Статус
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mediaList.items.map((media: any, index: number) => {
                const displayFilename = resolveDisplayFilename({
                  filename: media.filename,
                  extension: media.extension,
                  mimeType: media.mimeType,
                });

                const displayOriginalName = resolveDisplayFilename({
                  filename: media.originalName,
                  extension: media.extension,
                  mimeType: media.mimeType,
                });

                // Get usage context for auto-generated metadata
                const usageContext = media.usages.length > 0 
                  ? {
                      entityType: media.usages[0].entityType,
                      entityTitle: media.usages[0].entityName,
                    }
                  : undefined;

                // Resolve effective metadata
                const effectiveMetadata = resolveEffectiveMetadata(
                  {
                    title: media.title,
                    alt: media.alt,
                    caption: media.caption,
                    filename: displayFilename,
                  },
                  usageContext
                );

                // Always show title from metadata (manual or auto-generated)
                const displayTitle = effectiveMetadata.title || displayFilename;

                return (
                  <tr key={media.id} className={`hover:bg-gray-50 ${media.status === "ARCHIVED" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <MediaPreview
                        kind={media.kind}
                        publicUrl={media.publicUrl}
                        filename={media.filename}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/media/${media.id}`}
                            className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {displayTitle}
                          </Link>
                          {media.status === "ARCHIVED" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              Архивный
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{displayOriginalName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <MediaKindBadge 
                        kind={media.kind} 
                        extension={media.extension}
                        mimeType={media.mimeType}
                        originalName={media.originalName}
                        storageKey={media.storageKey}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{formatBytes(media.sizeBytes)}</p>
                      {media.width && media.height && (
                        <p className="text-xs text-gray-500">
                          {media.width}×{media.height}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                        media.usages.length > 0
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {media.usages.length}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {media.uploadedBy && (
                          <p className="text-xs text-gray-600">{media.uploadedBy.email}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          {formatDistance(media.createdAt, new Date(), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <MediaStatusBadge status={media.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/media/${media.id}`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Детали
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {mediaList.items.length === 0 && (
          <div className="text-center py-12">
            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Медиафайлы не найдены</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {mediaList.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Показано {mediaList.items.length} из {mediaList.pagination.total}
          </p>
          <div className="flex gap-2">
            {mediaList.pagination.hasPrev && (
              <button className="h-10 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Назад
              </button>
            )}
            {mediaList.pagination.hasNext && (
              <button className="h-10 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Далее
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
