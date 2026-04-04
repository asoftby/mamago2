import { getCurrentUser } from "@/lib/auth/server";
import { redirect, notFound } from "next/navigation";
import { getMediaAssetById } from "@/server/services/media/media.service";
import { getMediaUsagesWithDetails } from "@/server/services/media/media-usage.service";
import { MediaStatusBadge } from "@/components/admin/media/MediaStatusBadge";
import { MediaKindBadge } from "@/components/admin/media/MediaKindBadge";
import { MediaPreview } from "@/components/admin/media/MediaPreview";
import { TechnicalInfoDisclosure } from "@/components/admin/media/TechnicalInfoDisclosure";
import { MediaMetadataEditor } from "@/components/admin/media/MediaMetadataEditor";
import { MediaMetadataEditorLayout } from "@/components/admin/media/MediaMetadataEditorLayout";
import { MetadataSourceBadge } from "@/components/admin/media/MetadataSourceBadge";
import { MediaActions } from "@/components/admin/media/MediaActions";
import Link from "next/link";
import { formatDistance } from "date-fns";
import { ru } from "date-fns/locale";
import { formatBytes } from "@/lib/media/formatBytes";
import { resolveDisplayFileType } from "@/lib/media/resolveDisplayFileType";
import { resolveDisplayFilename } from "@/lib/media/resolveDisplayFilename";
import { getMediaUsageContext } from "@/lib/media/getMediaUsageContext";
import { resolveEffectiveMetadata, resolveEffectiveMetadataWithSources } from "@/lib/media/generateMediaMetadata";
import { buildMediaPageTitle } from "@/lib/media/buildMediaPageTitle";

export default async function AdminMediaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const media = await getMediaAssetById(id);

  if (!media) {
    notFound();
  }

  const usages = await getMediaUsagesWithDetails(id);

  const displayFileType = resolveDisplayFileType({
    mimeType: media.mimeType,
    extension: media.extension,
    originalName: media.originalName,
    storageKey: media.storageKey,
    publicUrl: media.publicUrl,
    filename: media.filename,
  });

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
  const usageContext = await getMediaUsageContext(id);

  // Get all media for the same entity (for numbering)
  let allMediaForEntity: Array<{ id: string; createdAt: Date }> | undefined;
  if (usageContext && usages.length > 0) {
    const firstUsage = usages[0];
    // Get all media for the same entity and field
    const { prisma } = await import("@/lib/prisma");
    allMediaForEntity = await prisma.mediaAsset.findMany({
      where: {
        usages: {
          some: {
            entityType: firstUsage.entityType,
            entityId: firstUsage.entityId,
            field: firstUsage.field,
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }
  
  // Resolve effective metadata (manual > auto > fallback)
  const effectiveMetadata = resolveEffectiveMetadata(
    {
      title: media.title,
      alt: media.alt,
      caption: media.caption,
      filename: displayFilename,
    },
    usageContext || undefined
  );

  // Resolve with source tracking for badges
  const metadataWithSources = resolveEffectiveMetadataWithSources(
    {
      title: media.title,
      alt: media.alt,
      caption: media.caption,
      filename: displayFilename,
    },
    usageContext || undefined
  );

  // Build page title: use metadata title, or filename WITHOUT extension as fallback
  const filenameWithoutExt = displayFilename.replace(/\.[^.]+$/, "");
  const pageTitle = effectiveMetadata.title || filenameWithoutExt;

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          <MediaKindBadge 
            kind={media.kind} 
            extension={media.extension}
            mimeType={media.mimeType}
            originalName={media.originalName}
            storageKey={media.storageKey}
          />
          <MediaStatusBadge status={media.status} />
        </div>
      </div>

      {/* Back Link */}
      <Link
        href="/admin/media"
        className="text-sm text-blue-600 hover:text-blue-700 inline-block"
      >
        ← Назад к медиатеке
      </Link>

      {/* Metadata Editor and Actions */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Preview and Usage (2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <MediaMetadataEditorLayout
            mediaId={media.id}
            media={{
              kind: media.kind,
              publicUrl: media.publicUrl,
              filename: media.filename,
              originalName: media.originalName,
              mimeType: media.mimeType,
              extension: media.extension,
              sizeBytes: media.sizeBytes,
              width: media.width,
              height: media.height,
            }}
            metadata={{
              alt: media.alt,
              title: media.title,
              caption: media.caption,
            }}
            metadataWithSources={metadataWithSources}
            autoGenerated={{
              alt: !media.alt ? effectiveMetadata.alt : undefined,
              title: !media.title ? effectiveMetadata.title : undefined,
              caption: !media.caption ? effectiveMetadata.caption : undefined,
            }}
            usageContext={usageContext}
          />

          {/* Usage Map */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-4">
            <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">
              Использование ({usages.length})
            </h2>
            {usages.length > 0 ? (
              <div className="space-y-3">
                {usages.map((usage: any) => (
                  <div
                    key={usage.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 uppercase">
                          {usage.entityType}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">{usage.field}</span>
                      </div>
                      {usage.entityName && (
                        <p className="text-sm font-medium text-gray-900 mt-1">
                          {usage.entityName}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1 font-mono">{usage.entityId}</p>
                    </div>
                    {usage.entityUrl && (
                      <Link
                        href={usage.entityUrl}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Открыть →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Файл не используется</p>
            )}
          </div>
        </div>

        {/* Right Column - Actions and Metadata */}
        <div className="lg:col-span-1 space-y-6">
          {/* Actions */}
          <MediaActions
            mediaId={media.id}
            status={media.status}
            usageCount={usages.length}
          />

          {/* Metadata Editor */}
          <MediaMetadataEditor
            mediaId={media.id}
            alt={media.alt}
            title={media.title}
            caption={media.caption}
            autoGeneratedAlt={!media.alt ? effectiveMetadata.alt : undefined}
            autoGeneratedTitle={!media.title ? effectiveMetadata.title : undefined}
            autoGeneratedCaption={!media.caption ? effectiveMetadata.caption : undefined}
          />

          {/* File Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-4">
            <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">Информация о файле</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Имя файла</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono break-all">{displayFilename}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Тип</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono">{media.mimeType}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Размер</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatBytes(media.sizeBytes)}</dd>
              </div>
              {media.width && media.height && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Разрешение</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {media.width} × {media.height} px
                  </dd>
                </div>
              )}
              {media.durationSec && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Длительность</dt>
                  <dd className="mt-1 text-sm text-gray-900">{media.durationSec} сек</dd>
                </div>
              )}
            </dl>
          </div>

          {/* System Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-4">
            <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">Системная информация</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Источник</dt>
                <dd className="mt-1 text-sm text-gray-900">{media.sourceType}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Загружен</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {media.uploadedBy?.email || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Создан</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDistance(media.createdAt, new Date(), {
                    addSuffix: true,
                    locale: ru,
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Обновлен</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDistance(media.updatedAt, new Date(), {
                    addSuffix: true,
                    locale: ru,
                  })}
                </dd>
              </div>
              {media.deletedAt && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Удален</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDistance(media.deletedAt, new Date(), {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Technical Info (Collapsible) */}
          <TechnicalInfoDisclosure
            storageKey={media.storageKey}
            publicUrl={media.publicUrl}
            checksum={media.checksum}
            filename={media.filename}
          />
        </div>
      </div>
    </div>
  );
}
