import type { ReactNode } from "react";
import Link from "next/link";
import { EmptyBlock } from "@/components/admin/ui/StateBlock";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  CircleAlert,
  Link2,
  Play,
  Settings2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import type {
  ImportEntityType,
  ImportReviewStatus,
  ImportReviewTaskStatus,
  Prisma,
} from "@prisma/client";
import { prismaBase } from "@/lib/prisma";
import { ReviewQueueTableClient } from "./_components/ReviewQueueTableClient";
import { ImportReviewFilters } from "./_components/ImportReviewFilters";
import {
  reconcileImportedRecordLinks,
  type ImportedRecordLinkSnapshot,
} from "@/server/modules/import/services/import-link-reconciliation.service";
import type { ReviewDecisionPayload } from "@/server/modules/import/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type QueueStageFilter = "PENDING" | "IN_PROGRESS" | "COMPLETED";
type QueueStageParam = QueueStageFilter | "ALL";

const importReviewImportedRecordSelect = {
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
  reviewDecision: true,
  applyResult: true,
  reviewStatus: true,
  source: { select: { id: true, name: true, slug: true } },
  reviewTask: {
    select: {
      id: true,
      status: true,
      suggestedAction: true,
    },
  },
} satisfies Prisma.ImportedRecordSelect;

type ImportReviewImportedRecordPrismaRow = Prisma.ImportedRecordGetPayload<{
  select: typeof importReviewImportedRecordSelect;
}>;

type ImportAdminDb = {
  importedRecord?: {
    findMany: (args: unknown) => Promise<unknown[]>;
    count: (args: unknown) => Promise<number>;
  };
  importSource?: {
    findMany: (args: unknown) => Promise<Array<{ id: string; name: string; slug: string }>>;
  };
};

type ReviewStatusCardTone =
  | "amber"
  | "blue"
  | "emerald"
  | "slate";

type ReviewStatusCard = {
  label: string;
  value: number;
  helper: string;
  href: string;
  tone: ReviewStatusCardTone;
  active: boolean;
  icon: ReactNode;
};

function getImportAdminDb(): ImportAdminDb {
  return prismaBase as unknown as ImportAdminDb;
}

function parseStage(raw: string | undefined): QueueStageFilter | undefined {
  const valid: QueueStageFilter[] = ["PENDING", "IN_PROGRESS", "COMPLETED"];
  return valid.includes(raw as QueueStageFilter)
    ? (raw as QueueStageFilter)
    : undefined;
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
        {
          reviewStatus: {
            in: ["APPROVED", "REJECTED", "SKIPPED"] as ImportReviewStatus[],
          },
        },
        {
          reviewTask: {
            is: {
              status: {
                in: ["COMPLETED", "CANCELLED"] as ImportReviewTaskStatus[],
              },
            },
          },
        },
      ],
    };
  }

  return undefined;
}

function buildReviewHref(next: {
  stage?: QueueStageParam;
  sourceId?: string;
  entityType?: string;
}) {
  const params = new URLSearchParams();
  const stage = next.stage;
  const sourceId = next.sourceId;
  const entityType = next.entityType;

  if (stage && stage !== "ALL") params.set("status", stage);
  if (stage === "ALL") params.set("status", "ALL");
  if (sourceId) params.set("source", sourceId);
  if (entityType) params.set("entity", entityType);

  const query = params.toString();
  return query ? `/admin/import/review?${query}` : "/admin/import/review";
}

async function getImportedObjects(filters: {
  stage?: QueueStageFilter;
  sourceId?: string;
  entityType?: ImportEntityType;
}) {
  const db = getImportAdminDb();
  if (!db.importedRecord) {
    return [];
  }

  const records = (await db.importedRecord.findMany({
    where: {
      ...(buildStageWhere(filters.stage) ?? {}),
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
      ...(filters.entityType ? { entityTypeHint: filters.entityType } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    select: importReviewImportedRecordSelect,
  })) as ImportReviewImportedRecordPrismaRow[];

  return reconcileImportedRecordLinks(records, prismaBase);
}

async function getQueueStats() {
  const db = getImportAdminDb();
  if (!db.importedRecord) {
    return {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      linked: 0,
    };
  }

  const linkedRecords = (await db.importedRecord.findMany({
    where: {
      OR: [
        { publishedPlaceId: { not: null } },
        { publishedActivityId: { not: null } },
      ],
    },
    select: {
      id: true,
      publishedPlaceId: true,
      publishedActivityId: true,
      reviewDecision: true,
      applyResult: true,
    },
  })) as ImportedRecordLinkSnapshot[];
  const reconciledLinkedRecords = await reconcileImportedRecordLinks(
    linkedRecords,
    prismaBase,
  );

  const [total, pending, inProgress, completed] = await Promise.all([
    db.importedRecord.count({ where: {} }),
    db.importedRecord.count({ where: { reviewStatus: "PENDING" } }),
    db.importedRecord.count({
      where: {
        OR: [
          { reviewStatus: "IN_REVIEW" },
          { reviewTask: { is: { status: "IN_PROGRESS" } } },
        ],
      },
    }),
    db.importedRecord.count({
      where: {
        OR: [
          { reviewStatus: { in: ["APPROVED", "REJECTED", "SKIPPED"] } },
          {
            reviewTask: {
              is: { status: { in: ["COMPLETED", "CANCELLED"] } },
            },
          },
        ],
      },
    }),
  ]);

  return {
    total,
    pending,
    inProgress,
    completed,
    linked: reconciledLinkedRecords.filter(
      (record) => record.publishedPlaceId || record.publishedActivityId,
    ).length,
  };
}

async function getSources() {
  const db = getImportAdminDb();
  if (!db.importSource) {
    return [];
  }

  return db.importSource.findMany({
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
  const requestedStage =
    sp.status === "ALL" ? undefined : parseStage(sp.status);
  const requestedSourceId = sp.source || undefined;
  const requestedEntityType =
    sp.entity === "PLACE" || sp.entity === "EVENT" || sp.entity === "OFFER"
      ? (sp.entity as ImportEntityType)
      : undefined;

  const stats = await getQueueStats();
  const hasAnyImportedObjects = stats.total > 0;
  const effectiveStage =
    requestedStage ?? (sp.status === "ALL" ? undefined : hasAnyImportedObjects ? "PENDING" : undefined);

  const [records, sources] = await Promise.all([
    getImportedObjects({
      stage: effectiveStage,
      sourceId: requestedSourceId,
      entityType: requestedEntityType,
    }),
    getSources(),
  ]);

  const preparedRecords = records.map((record) => {
    const normalizedData = record.normalizedData as Record<string, unknown> | null;
    const normalizedTitle =
      typeof normalizedData?.title === "string" ? normalizedData.title : null;

    return {
      id: record.id,
      createdAtLabel: formatDistanceToNow(record.createdAt, {
        addSuffix: true,
        locale: ru,
      }),
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
        linkRecovery:
          ((record.reviewDecision as ReviewDecisionPayload | null)?.recovery as
            | ReviewDecisionPayload["recovery"]
            | undefined) ?? null,
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

  const hasSecondaryFilters = Boolean(requestedSourceId || requestedEntityType);
  const hasActiveFilters = Boolean(
    sp.status || requestedSourceId || requestedEntityType,
  );
  const queueHeading =
    effectiveStage === "PENDING"
      ? "Нужно проверить сейчас"
      : effectiveStage === "IN_PROGRESS"
        ? "Объекты в работе"
        : effectiveStage === "COMPLETED"
          ? "Разобранные объекты"
          : "Все импортированные объекты";

  const statusCards: ReviewStatusCard[] = [
    {
      label: "Нужно проверить",
      value: stats.pending,
      helper: "Главный приоритет очереди",
      href: buildReviewHref({
        stage: "PENDING",
        sourceId: requestedSourceId,
        entityType: requestedEntityType,
      }),
      tone: "amber",
      active: effectiveStage === "PENDING",
      icon: <CircleAlert className="h-4 w-4" />,
    },
    {
      label: "В работе",
      value: stats.inProgress,
      helper: "Объекты, которые уже разбирают",
      href: buildReviewHref({
        stage: "IN_PROGRESS",
        sourceId: requestedSourceId,
        entityType: requestedEntityType,
      }),
      tone: "blue",
      active: effectiveStage === "IN_PROGRESS",
      icon: <Clock3 className="h-4 w-4" />,
    },
    {
      label: "Решение принято",
      value: stats.completed,
      helper: "Объекты с завершённым разбором",
      href: buildReviewHref({
        stage: "COMPLETED",
        sourceId: requestedSourceId,
        entityType: requestedEntityType,
      }),
      tone: "emerald",
      active: effectiveStage === "COMPLETED",
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: "Связаны с каталогом",
      value: stats.linked,
      helper: "Уже превратились в Place/Event",
      href: buildReviewHref({
        stage: "ALL",
        sourceId: requestedSourceId,
        entityType: requestedEntityType,
      }),
      tone: "slate",
      active: effectiveStage == null,
      icon: <Link2 className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-[linear-gradient(180deg,#fffdf8_0%,#ffffff_100%)] p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
              Import Queue
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
              Разбор импортированных объектов
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              Здесь видно, что требует внимания прямо сейчас: что пришло из
              импорта, что уже в работе и что уже удалось связать с каталогом.
              Экран ведёт по рабочему потоку без лишней технической нагрузки.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <Link
              href={
                hasAnyImportedObjects
                  ? "/admin/import/runs"
                  : "/admin/import/sources"
              }
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              {hasAnyImportedObjects ? (
                <>
                  <Play className="h-4 w-4" />
                  Запустить импорт
                </>
              ) : (
                <>
                  <Settings2 className="h-4 w-4" />
                  Настроить источник импорта
                </>
              )}
            </Link>
            <Link
              href="/admin/import/sources"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              Перейти к источникам
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-[24px] border border-stone-200/80 bg-white/90 p-4">
            <div className="text-sm font-medium text-stone-900">
              Рабочий поток
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FlowStepCard
                title="Источник"
                description="Проверить, что источник включён и актуален."
                href="/admin/import/sources"
              />
              <FlowStepCard
                title="Запуск"
                description="Запустить или открыть последний прогон."
                href="/admin/import/runs"
              />
              <FlowStepCard
                title="Очередь"
                description="Разобрать новые объекты и принять решение."
                href="/admin/import/review?status=PENDING"
              />
              <FlowStepCard
                title="Связать"
                description="Создать или привязать Place/Event к каталогу."
                href="/admin/import/review?status=COMPLETED"
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-4">
            <div className="text-sm font-medium text-amber-950">
              Что делать первым
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Начинайте с блока “Нужно проверить”. Если очередь пуста, переходите
              к источникам или запускайте новый импорт.
            </p>
            <div className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-amber-700">
              Сейчас в фокусе: {queueHeading}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {statusCards.map((card) => (
          <StatusEntryCard key={card.label} card={card} />
        ))}
      </section>

      <details className="group rounded-2xl border border-stone-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-stone-700">
          <span>Как устроен поток импорта</span>
          <span className="text-xs text-stone-400 transition group-open:rotate-180">
            ^
          </span>
        </summary>
        <div className="border-t border-stone-100 px-5 py-4 text-sm leading-6 text-stone-600">
          На этом экране вы работаете с импортированными объектами до того, как
          они станут карточками каталога. Источник и запуск живут отдельно,
          поэтому технические детали вынесены из основного фокуса и не мешают
          очереди ревью.
        </div>
      </details>

      {hasAnyImportedObjects ? (
        <>
          <section className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-stone-950">
                  {queueHeading}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  {preparedRecords.length > 0
                    ? `Показано ${preparedRecords.length} объектов для текущего среза.`
                    : "Для текущего среза объектов нет — попробуйте сменить фильтр или открыть весь список."}
                </p>
              </div>
              <ImportReviewFilters
                sources={sources}
                currentStage={
                  effectiveStage ??
                  (sp.status === "ALL" ? "ALL" : hasAnyImportedObjects ? "PENDING" : "ALL")
                }
                currentSourceId={requestedSourceId}
                currentEntityType={requestedEntityType}
              />
            </div>
          </section>

          {preparedRecords.length === 0 ? (
            <FilteredEmptyState
              hasSecondaryFilters={hasSecondaryFilters}
              resetHref="/admin/import/review?status=PENDING"
            />
          ) : (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-stone-700">
                  Очередь ревью
                </div>
                <Link
                  href="/admin/import/runs"
                  className="text-sm font-medium text-stone-500 transition hover:text-stone-900"
                >
                  Открыть запуски
                </Link>
              </div>
              <ReviewQueueTableClient records={preparedRecords} />
            </section>
          )}
        </>
      ) : (
        <StartEmptyState sourceCount={sources.length} />
      )}
    </div>
  );
}

function StatusEntryCard({ card }: { card: ReviewStatusCard }) {
  const toneClasses =
    card.tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : card.tone === "blue"
        ? "border-blue-200 bg-blue-50 text-blue-950"
        : card.tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-stone-200 bg-stone-50 text-stone-900";

  return (
    <Link
      href={card.href}
      className={`rounded-[24px] border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${toneClasses} ${
        card.active ? "ring-2 ring-stone-900/10" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{card.label}</div>
        <div className="opacity-75">{card.icon}</div>
      </div>
      <div className="mt-3 text-3xl font-semibold">{card.value}</div>
      <div className="mt-2 text-xs opacity-80">{card.helper}</div>
    </Link>
  );
}

function FlowStepCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-stone-200 bg-stone-50 p-4 transition hover:border-stone-300 hover:bg-stone-100/80"
    >
      <div className="text-sm font-semibold text-stone-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
    </Link>
  );
}

function StartEmptyState({ sourceCount }: { sourceCount: number }) {
  return (
    <section className="rounded-[28px] border border-dashed border-stone-300 bg-white px-8 py-16 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="mx-auto max-w-2xl">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
          Ready to Start
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
          Очередь пока пуста
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Когда вы запустите импорт, здесь появятся объекты для разбора и
          связывания с каталогом. Это нормальная стартовая точка, а не ошибка.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/admin/import/runs"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            <Play className="h-4 w-4" />
            Запустить импорт
          </Link>
          <Link
            href="/admin/import/sources"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            {sourceCount > 0 ? "Проверить источники" : "Добавить источник"}
          </Link>
        </div>
      </div>
    </section>
  );
}

function FilteredEmptyState({
  hasSecondaryFilters,
  resetHref,
}: {
  hasSecondaryFilters: boolean;
  resetHref: string;
}) {
  return (
    <section className="rounded-[28px] border border-stone-200 bg-white px-8 py-14 text-center">
      <div className="mx-auto max-w-xl">
        <h3 className="text-xl font-semibold text-stone-950">
          Для этого среза объектов не найдено
        </h3>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          {hasSecondaryFilters
            ? "Скорее всего, фильтры слишком узкие. Попробуйте открыть всю очередь или убрать источник / тип данных."
            : "В этой стадии сейчас пусто. Можно вернуться к приоритетной очереди или посмотреть все объекты."}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={resetHref}
            className="inline-flex items-center justify-center rounded-2xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Показать очередь “Нужно проверить”
          </Link>
          <Link
            href="/admin/import/review?status=ALL"
            className="inline-flex items-center justify-center rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Открыть все объекты
          </Link>
        </div>
      </div>
    </section>
  );
}
