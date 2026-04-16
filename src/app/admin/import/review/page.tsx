import Link from "next/link";
import prisma from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import type { ImportEntityType, ImportReviewStatus, ImportReviewTaskStatus } from "@prisma/client";
import { ReviewQueueTableClient } from "./_components/ReviewQueueTableClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type QueueStageFilter = "PENDING" | "IN_PROGRESS" | "COMPLETED";

function parseStage(raw: string | undefined): QueueStageFilter | undefined {
  const valid: QueueStageFilter[] = ["PENDING", "IN_PROGRESS", "COMPLETED"];
  return valid.includes(raw as QueueStageFilter) ? (raw as QueueStageFilter) : undefined;
}

function buildStageWhere(stage?: QueueStageFilter) {
  if (stage === "PENDING") {
    return { reviewStatus: "PENDING" as ImportReviewStatus };
  }

  if (stage === "IN_PROGRESS") {
    return {
      OR: [
        { reviewStatus: "IN_REVIEW" as ImportReviewStatus },
        { reviewTask: { is: { status: "IN_PROGRESS" as ImportReviewTaskStatus } } },
      ],
    };
  }

  if (stage === "COMPLETED") {
    return {
      OR: [
        { reviewStatus: { in: ["APPROVED", "REJECTED", "SKIPPED"] as ImportReviewStatus[] } },
        { reviewTask: { is: { status: { in: ["COMPLETED", "CANCELLED"] as ImportReviewTaskStatus[] } } } },
      ],
    };
  }

  return undefined;
}

async function getImportedObjects(filters: {
  stage?: QueueStageFilter;
  sourceId?: string;
  entityType?: ImportEntityType;
}) {
  return prisma.importedRecord.findMany({
    where: {
      ...(buildStageWhere(filters.stage) ?? {}),
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
      ...(filters.entityType ? { entityTypeHint: filters.entityType } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      createdAt: true,
      sourceUrl: true,
      entityTypeHint: true,
      qualityScore: true,
      confidenceScore: true,
      matchStatus: true,
      normalizedData: true,
      publishedPlaceId: true,
      publishedActivityId: true,
      reviewStatus: true,
      source: { select: { id: true, name: true, slug: true } },
      reviewTask: {
        select: {
          id: true,
          status: true,
          suggestedAction: true,
        },
      },
    },
  });
}

async function getQueueStats() {
  const [pending, inProgress, completed, linked] = await Promise.all([
    prisma.importedRecord.count({ where: { reviewStatus: "PENDING" } }),
    prisma.importedRecord.count({
      where: {
        OR: [
          { reviewStatus: "IN_REVIEW" },
          { reviewTask: { is: { status: "IN_PROGRESS" } } },
        ],
      },
    }),
    prisma.importedRecord.count({
      where: {
        OR: [
          { reviewStatus: { in: ["APPROVED", "REJECTED", "SKIPPED"] } },
          { reviewTask: { is: { status: { in: ["COMPLETED", "CANCELLED"] } } } },
        ],
      },
    }),
    prisma.importedRecord.count({
      where: {
        OR: [{ publishedPlaceId: { not: null } }, { publishedActivityId: { not: null } }],
      },
    }),
  ]);

  return { pending, inProgress, completed, linked };
}

async function getSources() {
  return prisma.importSource.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
}

export default async function ImportReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const filters = {
    stage: parseStage(sp.status),
    sourceId: sp.source || undefined,
    entityType:
      sp.entity === "PLACE" || sp.entity === "EVENT" || sp.entity === "OFFER"
        ? (sp.entity as ImportEntityType)
        : undefined,
  };

  const [records, stats, sources] = await Promise.all([
    getImportedObjects(filters),
    getQueueStats(),
    getSources(),
  ]);

  const preparedRecords = records.map((record) => {
    const normalizedData = record.normalizedData as Record<string, unknown> | null;
    const normalizedTitle =
      typeof normalizedData?.title === "string" ? normalizedData.title : null;

    return {
      id: record.id,
      createdAtLabel: formatDistanceToNow(record.createdAt, { addSuffix: true, locale: ru }),
      importedRecord: {
        id: record.id,
        sourceUrl: record.sourceUrl,
        entityTypeHint: record.entityTypeHint,
        qualityScore: record.qualityScore,
        confidenceScore: record.confidenceScore,
        matchStatus: record.matchStatus,
        normalizedTitle,
        publishedPlaceId: record.publishedPlaceId,
        publishedActivityId: record.publishedActivityId,
        reviewStatus: record.reviewStatus,
        source: record.source,
      },
      reviewTask: record.reviewTask
        ? {
            id: record.reviewTask.id,
            status: record.reviewTask.status,
            suggestedAction: record.reviewTask.suggestedAction,
          }
        : null,
    };
  });

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-semibold text-gray-950">Импортированные объекты</h2>
        <p className="mt-1 text-sm text-gray-600">
          Здесь лежат все реальные записи сырого импорта. Для каждой нормализованной записи места или события должна
          существовать задача ревью; отсутствие задачи отображается как ошибка пайплайна, а не как обычное состояние.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="text-sm font-medium text-amber-950">Главное различие</div>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Import Run считает реальные <code>ImportedRecord</code>. Эта страница теперь показывает тот же слой данных:
          сырой импорт, а не только созданные задачи ревью.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Нужно проверить" value={stats.pending} tone="amber" />
        <StatCard label="В работе" value={stats.inProgress} tone="blue" />
        <StatCard label="Решение принято" value={stats.completed} tone="emerald" />
        <StatCard label="Уже связаны с каталогом" value={stats.linked} tone="gray" />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Стадия</label>
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="">Все импортированные объекты</option>
              <option value="PENDING">Нужно проверить</option>
              <option value="IN_PROGRESS">В работе</option>
              <option value="COMPLETED">Решение принято</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Источник</label>
            <select
              name="source"
              defaultValue={sp.source ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="">Все источники</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Тип данных</label>
            <select
              name="entity"
              defaultValue={sp.entity ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="">Все типы</option>
              <option value="PLACE">Места</option>
              <option value="EVENT">События</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
          >
            Применить фильтры
          </button>
          {(sp.status || sp.source || sp.entity) && (
            <Link
              href="/admin/import/review"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Сбросить
            </Link>
          )}
        </form>
      </div>

      {preparedRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-gray-700">Нет импортированных объектов по выбранным фильтрам.</p>
          <p className="mt-2 text-sm text-gray-500">Сначала запустите импорт, затем вернитесь сюда для разбора результатов.</p>
        </div>
      ) : (
        <ReviewQueueTableClient records={preparedRecords} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "blue" | "emerald" | "gray";
}) {
  const classes =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : tone === "blue"
        ? "border-blue-200 bg-blue-50 text-blue-950"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-gray-200 bg-white text-gray-950";

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}
