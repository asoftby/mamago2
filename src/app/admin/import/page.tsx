import Link from "next/link";
import { prismaBase } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { formatImportEntity, importEntityBadgeClasses, runStatusClasses, runStatusLabels } from "./_lib/import-admin-ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ImportDashboardDb = {
  importSource?: {
    count: (args: unknown) => Promise<number>;
  };
  importRun?: {
    count: (args: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<any[]>;
  };
  importReviewTask?: {
    count: (args: unknown) => Promise<number>;
  };
  importedRecord?: {
    groupBy: (args: unknown) => Promise<Array<{ runId: string | null; _count: { _all: number } }>>;
  };
  $queryRaw: <T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => Promise<T>;
};

function getImportDashboardDb(): ImportDashboardDb {
  return prismaBase as unknown as ImportDashboardDb;
}

/** Границы «сегодня» в локальной TZ процесса — как раньше при isToday(parsed appliedAt). */
function getLocalDayRange(): { dayStart: Date; nextDayStart: Date } {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const nextDayStart = new Date(dayStart);
  nextDayStart.setDate(nextDayStart.getDate() + 1);
  return { dayStart, nextDayStart };
}

async function countAppliedToday(): Promise<number> {
  const db = getImportDashboardDb();
  const { dayStart, nextDayStart } = getLocalDayRange();
  try {
    const rows = await db.$queryRaw<[{ c: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS c
        FROM "ImportedRecord"
        WHERE ("publishedPlaceId" IS NOT NULL OR "publishedActivityId" IS NOT NULL)
          AND "applyResult" IS NOT NULL
          AND ("applyResult"->>'appliedAt') IS NOT NULL
          AND ("applyResult"->>'appliedAt')::timestamptz >= ${dayStart}
          AND ("applyResult"->>'appliedAt')::timestamptz < ${nextDayStart}
      `,
    );
    return Number(rows[0]?.c ?? 0);
  } catch (e) {
    console.error("import dashboard: countAppliedToday failed:", e);
    return 0;
  }
}

async function getDashboardData() {
  const db = getImportDashboardDb();
  const hasImportDelegates =
    Boolean(db.importSource) &&
    Boolean(db.importRun) &&
    Boolean(db.importReviewTask) &&
    Boolean(db.importedRecord);

  if (!hasImportDelegates) {
    return {
      allSources: 0,
      activeSources: 0,
      inactiveSources: 0,
      runsToday: 0,
      failedRunsToday: 0,
      pendingReview: 0,
      appliedToday: await countAppliedToday(),
      recentRuns: [],
      pendingByRunId: new Map<string, number>(),
      appliedByRunId: new Map<string, number>(),
      importRuntimeReady: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [allSources, activeSources, inactiveSources, runsToday, failedRunsToday, pendingReview, recentRuns, appliedToday] =
    await Promise.all([
      db.importSource!.count({ where: { archivedAt: null } }),
      db.importSource!.count({ where: { isActive: true, archivedAt: null } }),
      db.importSource!.count({ where: { isActive: false, archivedAt: null } }),
      db.importRun!.count({ where: { createdAt: { gte: today }, isArchived: false } }),
      db.importRun!.count({ where: { status: "FAILED", createdAt: { gte: today }, isArchived: false } }),
      db.importReviewTask!.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } }),
      db.importRun!.findMany({
        where: { isArchived: false },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          source: { select: { id: true, name: true, defaultEntity: true } },
        },
      }),
      countAppliedToday(),
    ]);

  const runIds = recentRuns.map((r) => r.id);
  let pendingByRunId = new Map<string, number>();
  let appliedByRunId = new Map<string, number>();

  if (runIds.length > 0) {
    const [pendingGroups, appliedGroups] = await Promise.all([
      db.importedRecord!.groupBy({
        by: ["runId"],
        where: { runId: { in: runIds }, reviewStatus: "PENDING" },
        _count: { _all: true },
      }),
      db.importedRecord!.groupBy({
        by: ["runId"],
        where: {
          runId: { in: runIds },
          applyResult: { not: Prisma.DbNull },
        },
        _count: { _all: true },
      }),
    ]);

    pendingByRunId = new Map(
      pendingGroups
        .filter((g): g is typeof g & { runId: string } => g.runId != null)
        .map((g) => [g.runId, g._count._all]),
    );
    appliedByRunId = new Map(
      appliedGroups
        .filter((g): g is typeof g & { runId: string } => g.runId != null)
        .map((g) => [g.runId, g._count._all]),
    );
  }

  return {
    allSources,
    activeSources,
    inactiveSources,
    runsToday,
    failedRunsToday,
    pendingReview,
    appliedToday,
    recentRuns,
    pendingByRunId,
    appliedByRunId,
    importRuntimeReady: true,
  };
}

export default async function ImportDashboardPage() {
  const dashboard = await getDashboardData();

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold text-gray-950">Обзор импорта</h2>
          <p className="mt-1 text-sm text-gray-600">
            Раздел больше не смешивает всё в одну очередь. Здесь отдельно видно, что настроено, что уже запускалось,
            какие импортированные объекты требуют разбора и сколько из них уже превратились в итоговые сущности.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/import/sources" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700">
            Добавить источник
          </Link>
          <Link href="/admin/import/debug/parser" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            Debug parser
          </Link>
        </div>
      </div>

      {!dashboard.importRuntimeReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-950">Импорт временно недоступен в этой сборке</div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
            Экран открыт в безопасном режиме: import-модели сейчас не подключены в Prisma client, поэтому статистика и
            история запусков временно пустые. Навигация по разделу остаётся доступной, а страницы больше не падают с
            server error.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Активные источники" value={dashboard.activeSources} helper={`${dashboard.inactiveSources} отключено`} tone="blue" href="/admin/import/sources" />
        <KpiCard label="Прогоны сегодня" value={dashboard.runsToday} helper={dashboard.failedRunsToday > 0 ? `${dashboard.failedRunsToday} с ошибкой` : "Без ошибок"} tone={dashboard.failedRunsToday > 0 ? "rose" : "emerald"} href="/admin/import/runs" />
        <KpiCard label="Нужно проверить" value={dashboard.pendingReview} helper="Импортированные объекты" tone="amber" href="/admin/import/review" />
        <KpiCard label="Создано сегодня" value={dashboard.appliedToday} helper="Place/Event после разбора" tone="emerald" href="/admin/import/review" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Пользовательский сценарий</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ScenarioCard
              step="1"
              title="Настроить источник"
              description="Источник описывает, откуда берем данные и какой парсер использовать."
              href="/admin/import/sources"
            />
            <ScenarioCard
              step="2"
              title="Запустить прогон"
              description="Прогон фиксирует один конкретный импорт и его технический результат."
              href="/admin/import/runs"
            />
            <ScenarioCard
              step="3"
              title="Разобрать импортированные объекты"
              description="Здесь лежит сырой импорт, а не готовые карточки каталога."
              href="/admin/import/review"
            />
            <ScenarioCard
              step="4"
              title="Создать или связать Place/Event"
              description="Итоговая сущность появляется только после решения и публикации."
              href="/admin/import/review"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-medium text-amber-950">Что теперь читается явно</div>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            <li>Источник не равен прогону.</li>
            <li>Прогон не равен импортированному объекту.</li>
            <li>Импортированный объект не равен Place/Event.</li>
            <li>Отключённые источники вынесены из рабочего списка.</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Последние прогоны</h3>
              <p className="mt-1 text-xs text-gray-500">Здесь только история запусков, без смешения с ревью и публикацией.</p>
            </div>
            <Link href="/admin/import/runs" className="text-sm font-medium text-blue-600 hover:underline">
              Все прогоны
            </Link>
          </div>
          {dashboard.recentRuns.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-500">Пока не было ни одного прогона.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Источник</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Статус</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Результат</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Когда</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dashboard.recentRuns.map((run) => {
                    const reviewCount = dashboard.pendingByRunId.get(run.id) ?? 0;
                    const appliedCount = dashboard.appliedByRunId.get(run.id) ?? 0;

                    return (
                      <tr key={run.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="font-medium text-gray-900">{run.source.name}</div>
                          {run.source.defaultEntity && (
                            <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${importEntityBadgeClasses[run.source.defaultEntity]}`}>
                              {formatImportEntity(run.source.defaultEntity)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${runStatusClasses[run.status]}`}>
                            {runStatusLabels[run.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-600">
                          <div>На разбор: {reviewCount}</div>
                          <div className="mt-1">Создано сущностей: {appliedCount}</div>
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-600">
                          <Link href={`/admin/import/runs/${run.id}`} className="font-medium text-blue-600 hover:underline">
                            {formatDistanceToNow(run.createdAt, { addSuffix: true, locale: ru })}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="text-sm font-semibold uppercase tracking-wide text-gray-700">Структура данных</div>
          <div className="mt-4 space-y-3">
            <FlowCard title="Источник" helper={`${dashboard.allSources} настроено, ${dashboard.activeSources} активно`} />
            <FlowCard title="Прогон" helper="Один запуск импорта по одному источнику" />
            <FlowCard title="Импортированный объект" helper="Сырая запись после нормализации и матчинга" />
            <FlowCard title="Place / Event" helper="Итоговая сущность каталога после ручного решения" accent />
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  helper,
  tone,
  href,
}: {
  label: string;
  value: number;
  helper: string;
  tone: "blue" | "amber" | "emerald" | "rose";
  href: string;
}) {
  const classes =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-950"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : "border-rose-200 bg-rose-50 text-rose-950";

  return (
    <Link href={href} className={`rounded-2xl border p-4 transition hover:shadow-sm ${classes}`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-2 text-xs opacity-80">{helper}</div>
    </Link>
  );
}

function ScenarioCard({
  step,
  title,
  description,
  href,
}: {
  step: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 transition hover:bg-gray-100">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Шаг {step}</div>
      <div className="mt-2 text-sm font-semibold text-gray-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
    </Link>
  );
}

function FlowCard({ title, helper, accent }: { title: string; helper: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50"}`}>
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{helper}</div>
    </div>
  );
}
