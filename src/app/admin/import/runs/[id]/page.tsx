import { notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { RunDetailActions } from "../_components/RunDetailActions";
import { RematchButton } from "../_components/RematchButton";
import {
  formatImportEntity,
  importEntityBadgeClasses,
  runStatusClasses,
  runStatusLabels,
} from "../../_lib/import-admin-ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_STYLES: Record<string, string> = {
  PENDING:   "bg-gray-100 text-gray-600",
  RUNNING:   "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED:    "bg-red-100 text-red-800",
  CANCELLED: "bg-yellow-100 text-yellow-800",
  SUCCESS:   "bg-green-100 text-green-800",
  SKIPPED:   "bg-gray-100 text-gray-500",
  MATCHED:   "bg-green-100 text-green-700",
  NO_MATCH:  "bg-blue-50 text-blue-700",
  AMBIGUOUS: "bg-yellow-100 text-yellow-700",
  APPROVED:  "bg-green-100 text-green-800",
  REJECTED:  "bg-red-100 text-red-700",
  IN_REVIEW: "bg-blue-100 text-blue-700",
};

function Badge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const cls = colorMap[value] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
}

type RecordFilter = "all" | "parse_failed" | "normalize_failed" | "review_pending" | "approved" | "applied";

function parseFilter(raw: string | undefined): RecordFilter {
  const valid: RecordFilter[] = ["all", "parse_failed", "normalize_failed", "review_pending", "approved", "applied"];
  return valid.includes(raw as RecordFilter) ? (raw as RecordFilter) : "all";
}

async function getRun(id: string) {
  return prisma.importRun.findUnique({
    where: { id },
    include: {
      source: { select: { id: true, name: true, slug: true, parserKey: true, defaultEntity: true } },
      records: { select: { applyResult: true } },
    },
  });
}

/** Записи, для которых имеет смысл кнопка repair/rematch: нет задачи или matching в SKIPPED (PLACE/EVENT). */
async function getOrphanedCount(runId: string): Promise<number> {
  return prisma.importedRecord.count({
    where: {
      runId,
      OR: [
        { reviewTask: null },
        {
          normalizeStatus: "SUCCESS",
          entityTypeHint: { in: ["PLACE", "EVENT"] },
          matchStatus: "SKIPPED",
        },
      ],
    },
  });
}

async function getRecords(runId: string, filter: RecordFilter) {
  const where: Record<string, unknown> = { runId };

  if (filter === "parse_failed")     where.parseStatus = "FAILED";
  if (filter === "normalize_failed") where.normalizeStatus = "FAILED";
  if (filter === "review_pending")   where.reviewStatus = "PENDING";
  if (filter === "approved")         where.reviewStatus = "APPROVED";
  if (filter === "applied")          where.applyResult = { not: null };

  return prisma.importedRecord.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      externalId: true,
      sourceUrl: true,
      entityTypeHint: true,
      parseStatus: true,
      normalizeStatus: true,
      matchStatus: true,
      reviewStatus: true,
      qualityScore: true,
      applyResult: true,
      normalizedData: true,
      reviewTask: { select: { id: true } },
    },
  });
}

export default async function RunDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const filter = parseFilter(sp.filter);

  const run = await getRun(id);
  if (!run) notFound();

  const [records, orphanedCount] = await Promise.all([
    getRecords(id, filter),
    getOrphanedCount(id),
  ]);
  const appliedCount = run.records.filter((r) => r.applyResult !== null).length;

  const duration = run.startedAt && run.finishedAt
    ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000)
    : null;

  const FILTERS: { key: RecordFilter; label: string }[] = [
    { key: "all", label: "Все объекты" },
    { key: "parse_failed", label: "Ошибка парсинга" },
    { key: "normalize_failed", label: "Ошибка нормализации" },
    { key: "review_pending", label: "Нужно проверить" },
    { key: "approved", label: "Готово к публикации" },
    { key: "applied", label: "Уже созданы сущности" },
  ];

  return (
    <div className="p-6 max-w-6xl space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/admin/import/runs" className="hover:text-gray-700">← Запуски</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{run.source.name}</span>
          {run.isArchived && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
              архив
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RematchButton runId={run.id} orphanedCount={orphanedCount} />
          <RunDetailActions
            runId={run.id}
            sourceName={run.source.name}
            appliedCount={appliedCount}
            isArchived={run.isArchived}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Прогон показывает техническую историю запуска. Записи ниже всё ещё являются импортированными объектами,
        а не готовыми Place/Event, пока для них не создана итоговая сущность.
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Сводка по прогону</h1>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${runStatusClasses[run.status]}`}>
              {runStatusLabels[run.status]}
            </span>
            {run.source.defaultEntity && (
              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${importEntityBadgeClasses[run.source.defaultEntity] ?? "bg-gray-100 text-gray-600"}`}>
                {formatImportEntity(run.source.defaultEntity)}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400">
            {run.startedAt && format(run.startedAt, "dd MMM yyyy HH:mm", { locale: ru })}
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <RunStat label="Источник" value={run.source.name} />
          <RunStat label="Parser" value={run.source.parserKey ?? "—"} mono />
          <RunStat label="Длительность" value={duration != null ? `${duration}с` : "—"} />
          <RunStat label="Тип запуска" value={run.triggerType} />
        </div>
        <div className="px-4 pb-4 grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: "Получено", value: run.totalFetched, color: "text-gray-700" },
            { label: "Разобрано", value: run.totalParsed, color: "text-gray-700" },
            { label: "Создано", value: run.totalCreated, color: "text-green-700" },
            { label: "Пропущено", value: run.totalSkipped, color: "text-gray-500" },
            { label: "Отклонено", value: run.totalRejected, color: "text-gray-500" },
            { label: "Ошибок", value: run.totalErrors, color: run.totalErrors > 0 ? "text-red-600" : "text-gray-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
              <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        {run.errorMessage && (
          <div className="px-4 pb-4">
            <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {run.errorMessage}
            </div>
          </div>
        )}
      </div>

      {/* Records list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Импортированные объекты ({records.length})
          </h2>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/admin/import/runs/${id}?filter=${f.key}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.key
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {records.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
            Нет записей по выбранному фильтру.
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-600">Импортированный объект</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-600">Тип</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-600">Parse</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-600">Normalize</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-600">Match</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-600">Review</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-600">Quality</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-600">Итоговая сущность</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((rec) => {
                  const nd = rec.normalizedData as Record<string, unknown> | null;
                  const title = typeof nd?.title === "string" ? nd.title : null;
                  const isApplied = rec.applyResult !== null;

                  return (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <div className="text-xs font-medium text-gray-900 truncate max-w-[180px]">
                          {title ?? <span className="text-gray-400 italic">без названия</span>}
                        </div>
                        {rec.externalId && (
                          <div className="text-xs text-gray-400 font-mono truncate max-w-[180px]">{rec.externalId}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {rec.entityTypeHint && (
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${importEntityBadgeClasses[rec.entityTypeHint] ?? "bg-gray-100 text-gray-600"}`}>
                            {formatImportEntity(rec.entityTypeHint)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><Badge value={rec.parseStatus} colorMap={STATUS_STYLES} /></td>
                      <td className="px-3 py-2.5"><Badge value={rec.normalizeStatus} colorMap={STATUS_STYLES} /></td>
                      <td className="px-3 py-2.5"><Badge value={rec.matchStatus} colorMap={STATUS_STYLES} /></td>
                      <td className="px-3 py-2.5"><Badge value={rec.reviewStatus} colorMap={STATUS_STYLES} /></td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 tabular-nums">
                        {rec.qualityScore != null ? `${(rec.qualityScore * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {isApplied
                          ? <span className="text-green-700 font-medium">Создана</span>
                          : <span className="text-gray-400">Ещё нет</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {rec.reviewTask ? (
                          <Link href={`/admin/import/review/${rec.reviewTask.id}`}
                            className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                            Открыть →
                          </Link>
                        ) : rec.normalizeStatus === "SUCCESS" &&
                          (rec.entityTypeHint === "PLACE" || rec.entityTypeHint === "EVENT") ? (
                          <Link
                            href={`/admin/import/review/${rec.id}`}
                            className="text-xs text-rose-600 hover:text-rose-800 hover:underline whitespace-nowrap"
                            title="Нет ImportReviewTask — откройте запись (попытка автовосстановления при загрузке)"
                          >
                            Ошибка →
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RunStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-sm font-medium text-gray-900 mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
