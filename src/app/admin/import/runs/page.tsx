import Link from "next/link";
import { prismaBase } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import type {
  ImportEntityType,
  ImportReviewStatus,
  ImportRunStatus,
} from "@prisma/client";
import { RunRowActions } from "./_components/RunRowActions";
import {
  formatImportEntity,
  importEntityBadgeClasses,
  runStatusClasses,
  runStatusLabels,
} from "../_lib/import-admin-ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ImportRunRecordStub = {
  applyResult: unknown;
  reviewStatus: ImportReviewStatus;
};

type ImportRunListRow = {
  id: string;
  status: ImportRunStatus;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  isArchived: boolean;
  totalFetched: number;
  totalParsed: number;
  totalCreated: number;
  totalErrors: number;
  source: {
    id: string;
    name: string;
    slug: string;
    defaultEntity: ImportEntityType | null;
    isActive: boolean;
    archivedAt: Date | null;
  };
  records: ImportRunRecordStub[];
};

type ImportRunsDb = {
  importRun?: {
    findMany: (args: unknown) => Promise<ImportRunListRow[]>;
  };
  importSource?: {
    findMany: (args: unknown) => Promise<Array<{ id: string; name: string }>>;
  };
};

function getImportRunsDb(): ImportRunsDb {
  return prismaBase as unknown as ImportRunsDb;
}

function parseStatus(raw: string | undefined): ImportRunStatus | undefined {
  const valid: ImportRunStatus[] = ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"];
  return valid.includes(raw as ImportRunStatus) ? (raw as ImportRunStatus) : undefined;
}

function parseEntity(raw: string | undefined): ImportEntityType | undefined {
  const valid: ImportEntityType[] = ["PLACE", "EVENT", "OFFER"];
  return valid.includes(raw as ImportEntityType) ? (raw as ImportEntityType) : undefined;
}

type ArchiveFilter = "active" | "archived" | "all";

function parseArchiveFilter(raw: string | undefined): ArchiveFilter {
  if (raw === "archived" || raw === "all") return raw;
  return "active";
}

async function getRuns(filters: {
  status?: ImportRunStatus;
  entityType?: ImportEntityType;
  sourceId?: string;
  archiveFilter: ArchiveFilter;
}): Promise<ImportRunListRow[]> {
  const db = getImportRunsDb();
  if (!db.importRun) {
    return [];
  }

  const archiveWhere =
    filters.archiveFilter === "active"
      ? { isArchived: false }
      : filters.archiveFilter === "archived"
      ? { isArchived: true }
      : {};

  return db.importRun.findMany({
    where: {
      ...archiveWhere,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
      ...(filters.entityType ? { source: { defaultEntity: filters.entityType } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      source: {
        select: { id: true, name: true, slug: true, defaultEntity: true, isActive: true, archivedAt: true },
      },
      records: { select: { applyResult: true, reviewStatus: true } },
    },
  });
}

async function getSources() {
  const db = getImportRunsDb();
  if (!db.importSource) {
    return [];
  }

  return db.importSource.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export default async function ImportRunsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const archiveFilter = parseArchiveFilter(sp.archive);
  const filters = {
    status: parseStatus(sp.status),
    entityType: parseEntity(sp.entity),
    sourceId: sp.source || undefined,
    archiveFilter,
  };
  const importRuntimeReady = Boolean(getImportRunsDb().importRun && getImportRunsDb().importSource);

  const [runs, sources] = await Promise.all([getRuns(filters), getSources()]);
  const hasFilters = sp.status || sp.entity || sp.source || sp.archive;

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-semibold text-gray-950">Прогоны импорта</h2>
        <p className="mt-1 text-sm text-gray-600">
          Прогон показывает технический результат одного запуска импорта. Это отдельный слой между источником и импортированными объектами.
        </p>
      </div>

      {!importRuntimeReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-950">История запусков временно недоступна</div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
            Import runs скрыты в safe mode, потому что текущий Prisma client не содержит import-модели. Экран остаётся
            доступным без server error и показывает пустое состояние вместо падения.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Показывать</label>
            <select name="archive" defaultValue={sp.archive ?? "active"} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <option value="active">Рабочие прогоны</option>
              <option value="archived">Архив</option>
              <option value="all">Все</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Статус</label>
            <select name="status" defaultValue={sp.status ?? ""} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <option value="">Все статусы</option>
              <option value="COMPLETED">Завершён</option>
              <option value="FAILED">С ошибкой</option>
              <option value="RUNNING">Идёт импорт</option>
              <option value="PENDING">В очереди</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Тип</label>
            <select name="entity" defaultValue={sp.entity ?? ""} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <option value="">Все типы</option>
              <option value="PLACE">Места</option>
              <option value="EVENT">События</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Источник</label>
            <select name="source" defaultValue={sp.source ?? ""} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <option value="">Все источники</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700">
            Применить фильтры
          </button>
          {hasFilters && (
            <Link href="/admin/import/runs" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
              Сбросить
            </Link>
          )}
        </form>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-gray-700">Прогоны по выбранным условиям не найдены.</p>
          <p className="mt-2 text-sm text-gray-500">Сначала запустите импорт из активного источника.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Прогон</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Счётчики</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Когда</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map((run) => {
                const appliedCount = run.records.filter((record) => record.applyResult !== null).length;
                const pendingReviewCount = run.records.filter((record) => record.reviewStatus === "PENDING").length;
                const duration =
                  run.startedAt && run.finishedAt
                    ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000)
                    : null;

                return (
                  <tr key={run.id} className={run.isArchived ? "bg-gray-50/70" : "hover:bg-gray-50"}>
                    <td className="px-4 py-4 align-top">
                      <div className="font-medium text-gray-900">{run.source.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {run.source.defaultEntity && (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${importEntityBadgeClasses[run.source.defaultEntity]}`}>
                            {formatImportEntity(run.source.defaultEntity)}
                          </span>
                        )}
                        {run.isArchived && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">архив</span>}
                        {!run.source.isActive && !run.source.archivedAt && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">источник отключён</span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">ID прогона: {run.id}</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${runStatusClasses[run.status]}`}>
                        {runStatusLabels[run.status]}
                      </span>
                      {run.errorMessage && (
                        <div className="mt-2 max-w-xs rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-700">
                          {run.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-xs text-gray-600">
                      <div>Получено: {run.totalFetched}</div>
                      <div className="mt-1">Разобрано: {run.totalParsed}</div>
                      <div className="mt-1">Создано сырого импорта: {run.totalCreated}</div>
                      <div className="mt-1">Нужно проверить: {pendingReviewCount}</div>
                      <div className="mt-1">Создано сущностей: {appliedCount}</div>
                      <div className="mt-1">Ошибок: {run.totalErrors}</div>
                    </td>
                    <td className="px-4 py-4 align-top text-xs text-gray-600">
                      <div>{formatDistanceToNow(run.createdAt, { addSuffix: true, locale: ru })}</div>
                      <div className="mt-1">Длительность: {duration != null ? `${duration} сек` : "—"}</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/import/runs/${run.id}`}
                          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-700"
                        >
                          Открыть прогон
                        </Link>
                        <RunRowActions
                          runId={run.id}
                          sourceName={run.source.name}
                          appliedCount={appliedCount}
                          isArchived={run.isArchived}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
