import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { listImportSources } from "@/server/modules/import/services/import-source.service";
import { getParserDefinition } from "@/server/modules/import/parsers/parser-definitions";
import { ArchiveSourceButton } from "./_components/ArchiveSourceButton";
import { CreateSourceModal } from "./_components/CreateSourceModal";
import { ActivateSourceButton, DeactivateSourceButton } from "./_components/DeactivateSourceButton";
import { DeleteSourcePermanentlyButton } from "./_components/DeleteSourcePermanentlyButton";
import { EditSourceModal } from "./_components/EditSourceModal";
import { SourceActionsCell } from "./_components/SourceActionsCell";
import {
  formatImportEntity,
  importEntityBadgeClasses,
  sourceStatusClasses,
  sourceStatusLabels,
} from "../_lib/import-admin-ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SourceView = "active" | "inactive" | "archived" | "all";

function parseSourceView(raw: string | undefined): SourceView {
  if (raw === "inactive" || raw === "archived" || raw === "all") return raw;
  return "active";
}

const DEV_MODE = process.env.NODE_ENV === "development";

export default async function ImportSourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const view = parseSourceView(sp.view);
  let sources: Awaited<ReturnType<typeof listImportSources>> = [];
  let importRuntimeReady = true;

  try {
    sources = await listImportSources({
      includeArchived: true,
      includeInactive: true,
    });
  } catch (error) {
    importRuntimeReady = false;
    console.error("import sources: safe mode fallback activated", error);
  }

  const activeSources = sources.filter((source) => source.isActive && !source.archivedAt);
  const inactiveSources = sources.filter((source) => !source.isActive && !source.archivedAt);
  const archivedSources = sources.filter((source) => !!source.archivedAt);

  const visibleSources =
    view === "inactive"
      ? inactiveSources
      : view === "archived"
      ? archivedSources
      : view === "all"
      ? sources
      : activeSources;

  const viewTabs = [
    { key: "active", label: `Активные (${activeSources.length})`, href: "/admin/import/sources" },
    { key: "inactive", label: `Отключённые (${inactiveSources.length})`, href: "/admin/import/sources?view=inactive" },
    { key: "archived", label: `Архив (${archivedSources.length})`, href: "/admin/import/sources?view=archived" },
    { key: "all", label: `Все (${sources.length})`, href: "/admin/import/sources?view=all" },
  ] as const;

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold text-gray-950">Источники импорта</h2>
          <p className="mt-1 text-sm text-gray-600">
            Источник определяет, откуда мы забираем данные и каким парсером их превращаем в сырой импорт.
            Отключённый источник не участвует в новых прогонах, но сохраняет историю для аудита и повторной проверки.
          </p>
        </div>
        <CreateSourceModal devMode={DEV_MODE} />
      </div>

      {!importRuntimeReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm font-semibold text-amber-950">Источники временно недоступны в этой сборке</div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
            Список открыт в safe mode: import-модели сейчас не подключены в Prisma client, поэтому данные по источникам
            временно не загружаются. Экран остаётся доступным без server error, а рабочая навигация по import-разделу не
            обрывается.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm font-medium text-emerald-900">Активные источники</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-950">{activeSources.length}</div>
          <p className="mt-2 text-xs text-emerald-800">Только они видны в рабочем сценарии и могут запускать новые импорты.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-medium text-amber-900">Отключённые</div>
          <div className="mt-2 text-3xl font-semibold text-amber-950">{inactiveSources.length}</div>
          <p className="mt-2 text-xs text-amber-800">Хранятся отдельно, чтобы не смешиваться с рабочими источниками и не создавать ложное ощущение активности.</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-900">Почему не удаляем источник</div>
          <p className="mt-2 text-xs leading-5 text-gray-600">
            У источника остаются прогоны, импортированные объекты и история решений. Поэтому вместо удаления используется отключение и архив.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {viewTabs.map((tab) => {
          const active = tab.key === view;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active ? "bg-gray-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Источник</div>
            <p className="mt-1 text-sm text-gray-600">Правило, откуда брать данные и каким парсером их читать.</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Прогон</div>
            <p className="mt-1 text-sm text-gray-600">Один конкретный запуск импорта по выбранному источнику.</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Импортированный объект</div>
            <p className="mt-1 text-sm text-gray-600">Сырая запись после импорта. Это ещё не Place и не Event платформы.</p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Итоговая сущность</div>
            <p className="mt-1 text-sm text-gray-600">Place или Event/Activity, созданный только после ручного решения и публикации.</p>
          </div>
        </div>
      </div>

      {visibleSources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-gray-700">
            {view === "active" && "Нет активных источников."}
            {view === "inactive" && "Нет отключённых источников."}
            {view === "archived" && "Архив пока пуст."}
            {view === "all" && "Источники ещё не настроены."}
          </p>
          <p className="mt-2 text-sm text-gray-500">Начните с создания источника и назначения парсера.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Источник</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Что импортирует</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Состояние</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Последняя активность</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleSources.map((source) => {
                const parserDef = source.parserKey ? getParserDefinition(source.parserKey) : null;
                const isArchived = !!source.archivedAt;
                const isInactive = !source.isActive && !isArchived;
                const visibilityLabel = isArchived
                  ? "В архиве"
                  : isInactive
                  ? "Скрыт из рабочего списка"
                  : "В рабочем списке";

                return (
                  <tr key={source.id} className={isArchived ? "bg-gray-50/60" : "hover:bg-gray-50"}>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-gray-900">{source.name}</div>
                        {isArchived && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">архив</span>}
                        {isInactive && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">отключён</span>}
                      </div>
                      <div className="mt-1 text-xs font-mono text-gray-500">{source.slug}</div>
                      {source.baseUrl && (
                        <a
                          href={source.baseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block max-w-[24rem] truncate text-xs text-blue-600 hover:underline"
                        >
                          {source.baseUrl}
                        </a>
                      )}
                      {source.notes && <p className="mt-2 max-w-[30rem] text-xs text-gray-500">{source.notes}</p>}
                    </td>
                    <td className="px-4 py-4 align-top">
                      {source.defaultEntity && (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${importEntityBadgeClasses[source.defaultEntity]}`}>
                          {formatImportEntity(source.defaultEntity)}
                        </span>
                      )}
                      <div className="mt-2 text-xs text-gray-600">
                        <div className="font-medium text-gray-800">{parserDef?.label ?? "Парсер не назначен"}</div>
                        <div className="mt-0.5 font-mono text-gray-500">{source.parserKey ?? "—"}</div>
                        {!source.parserKey && (
                          <div className="mt-1 text-amber-700">Источник нельзя запускать, пока не выбран парсер.</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sourceStatusClasses[source.status]}`}>
                        {sourceStatusLabels[source.status]}
                      </span>
                      <div className="mt-2 text-xs text-gray-600">{visibilityLabel}</div>
                      {source.lastErrorMessage && (
                        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs text-rose-700">
                          Последняя ошибка: {source.lastErrorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-xs text-gray-600">
                      <div>
                        Последний прогон:{" "}
                        <span className="font-medium text-gray-800">
                          {source.lastRunAt ? formatDistanceToNow(source.lastRunAt, { addSuffix: true, locale: ru }) : "ещё не запускался"}
                        </span>
                      </div>
                      <div className="mt-2">
                        Последний успешный:{" "}
                        <span className="font-medium text-gray-800">
                          {source.lastSuccessAt ? formatDistanceToNow(source.lastSuccessAt, { addSuffix: true, locale: ru }) : "нет"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/import/runs?source=${source.id}`}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          История прогонов
                        </Link>
                        <EditSourceModal source={source} devMode={DEV_MODE} />
                        {!isArchived && source.isActive && <SourceActionsCell sourceId={source.id} parserKey={source.parserKey} />}
                        {!isArchived && source.isActive && <DeactivateSourceButton sourceId={source.id} sourceName={source.name} />}
                        {!isArchived && !source.isActive && <ActivateSourceButton sourceId={source.id} sourceName={source.name} />}
                        {!isArchived && <ArchiveSourceButton sourceId={source.id} sourceName={source.name} />}
                      </div>
                      {isArchived && (
                        <div className="mt-2 space-y-2">
                          <p className="max-w-xs text-xs text-gray-500">
                            Источник сохранён только для истории. Его старые прогоны и объекты по-прежнему доступны в разделе импортов.
                          </p>
                          {view === "archived" && (
                            <DeleteSourcePermanentlyButton
                              sourceId={source.id}
                              sourceName={source.name}
                            />
                          )}
                        </div>
                      )}
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
