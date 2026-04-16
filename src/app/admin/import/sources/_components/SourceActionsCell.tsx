"use client";

import { useState } from "react";
import Link from "next/link";
import { triggerImportRun, testImportSource } from "../../actions";

interface Props {
  sourceId: string;
  parserKey: string | null;
}

type Mode = "idle" | "testing" | "running";

export function SourceActionsCell({ sourceId, parserKey }: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [testResult, setTestResult] = useState<Awaited<ReturnType<typeof testImportSource>> | null>(null);
  const [runResult, setRunResult] = useState<{ success: boolean; runId?: string; stats?: Record<string, number>; error?: string } | null>(null);
  const [showTestDetail, setShowTestDetail] = useState(false);

  async function handleTest() {
    setMode("testing");
    setTestResult(null);
    setRunResult(null);
    const res = await testImportSource(sourceId);
    setTestResult(res);
    setMode("idle");
    setShowTestDetail(true);
  }

  async function handleRun() {
    setMode("running");
    setRunResult(null);
    setTestResult(null);
    const res = await triggerImportRun(sourceId);
    setRunResult(res as typeof runResult);
    setMode("idle");
  }

  const canTest = !!parserKey;
  const debugData = testResult?.debug ? (testResult.debug as Record<string, unknown>) : null;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={handleTest}
          disabled={mode !== "idle" || !canTest}
          title={!canTest ? "Для проверки нужно назначить парсер" : "Проверить парсер без записи в базу"}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mode === "testing" ? "Проверяем…" : "Проверить парсер"}
        </button>
        <button
          onClick={handleRun}
          disabled={mode !== "idle" || !canTest}
          title={!canTest ? "Для запуска нужно назначить парсер" : "Создать новый прогон импорта"}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mode === "running" ? "Запускаем…" : "Запустить импорт"}
        </button>
      </div>

      {testResult && (
        <div className={`text-xs rounded p-2 ${testResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          {testResult.success ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium text-green-800">
                  Проверка успешна: найдено {testResult.totalParsed} записей
                </span>
                <button onClick={() => setShowTestDetail(!showTestDetail)}
                  className="text-green-600 hover:underline ml-2">
                  {showTestDetail ? "Скрыть детали" : "Показать детали"}
                </button>
              </div>
              {showTestDetail && (
                <div className="mt-2 space-y-2">
                  {debugData && (
                    <div className="rounded border border-green-200 bg-white p-2 text-xs text-gray-700 space-y-0.5">
                      <div className="font-medium text-gray-800">Что увидел парсер</div>
                      {"pagesVisited" in debugData && (
                        <>
                          <div>Страниц просмотрено: <b>{String(debugData.pagesVisited ?? "—")}</b> / ссылок найдено: <b>{String(debugData.linksDiscovered ?? "—")}</b></div>
                          <div>Карточек-кандидатов: <b>{String(debugData.detailCandidates ?? "—")}</b> / записей извлечено: <b>{String(debugData.recordsExtracted ?? "—")}</b></div>
                          {typeof debugData.limitReached === "string" && debugData.limitReached && (
                            <div className="text-yellow-700">Лимит достигнут: {debugData.limitReached}</div>
                          )}
                        </>
                      )}
                      {"detailLinksFound" in debugData && (
                        <>
                          <div>Карточек: <b>{String(debugData.listItemsCount ?? "—")}</b> / детальных ссылок: <b>{String(debugData.detailLinksFound ?? "—")}</b> / посещено: <b>{String(debugData.detailPagesVisited ?? "—")}</b></div>
                          <div>Извлечено: <b>{String(debugData.recordsExtracted ?? "—")}</b> / пропущено: <b>{String(debugData.skippedPages ?? "—")}</b></div>
                        </>
                      )}
                      {Array.isArray(debugData.warnings) &&
                        debugData.warnings.length > 0 && (
                        <div className="text-yellow-700">
                          {debugData.warnings.slice(0, 2).map((warning, index) => (
                            <div key={index}>{String(warning)}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {testResult.previews?.map((p, i) => (
                    <TestPreviewItem key={i} preview={p} index={i} />
                  ))}
                </div>
              )}            </>
          ) : (
            <span className="text-red-700">❌ {testResult.error}</span>
          )}
        </div>
      )}

      {/* Run result */}
      {runResult && (
        <div className={`text-xs rounded p-2 ${runResult.success ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200"}`}>
          {runResult.success ? (
            <div className="text-blue-800 space-y-0.5">
              <div className="font-medium">Прогон создан</div>
              {runResult.stats && (
                <>
                  <div>Получено: {runResult.stats.totalFetched} / разобрано: {runResult.stats.totalParsed}</div>
                  <div>Создано объектов: {runResult.stats.totalCreated} / ошибок: {runResult.stats.totalErrors}</div>
                  {(runResult.stats.reviewTasksCreated ?? 0) > 0 && (
                    <div className="font-medium">Нужно проверить: {runResult.stats.reviewTasksCreated}</div>
                  )}
                </>
              )}
              {runResult.runId && (
                        <Link href={`/admin/import/runs/${runResult.runId}`} className="mt-1 inline-flex text-blue-700 underline underline-offset-2">
                          Открыть прогон
                        </Link>
                      )}
                    </div>
                  ) : (
                    <span className="text-red-700">{runResult.error}</span>
                  )}
                </div>
              )}
    </div>
  );
}

function TestPreviewItem({
  preview,
  index,
}: {
  preview: {
    externalId: string | null;
    sourceUrl: string;
    normalized: unknown;
    qualityScore: number;
    warnings: string[];
    error?: string;
  };
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const nd = preview.normalized as Record<string, unknown> | null;
  const title = typeof nd?.title === "string" ? nd.title : null;

  return (
    <div className="rounded border border-green-200 bg-white p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-gray-800 truncate">
          {title ?? preview.externalId ?? `#${index + 1}`}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`font-medium ${preview.qualityScore >= 0.6 ? "text-green-700" : preview.qualityScore >= 0.3 ? "text-yellow-700" : "text-red-600"}`}>
            {(preview.qualityScore * 100).toFixed(0)}%
          </span>
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>
      {preview.error && (
        <div className="text-red-600 mt-1">⚠ {preview.error}</div>
      )}
      {preview.warnings.length > 0 && (
        <div className="text-yellow-700 mt-1">
          {preview.warnings.slice(0, 2).map((w, i) => <div key={i}>⚠ {w}</div>)}
          {preview.warnings.length > 2 && <div>+{preview.warnings.length - 2} ещё</div>}
        </div>
      )}
      {expanded && Boolean(preview.normalized) && (
        <pre className="mt-2 text-xs bg-gray-50 rounded p-2 overflow-auto max-h-40 text-gray-700">
          {JSON.stringify(preview.normalized, null, 2)}
        </pre>
      )}
    </div>
  );
}
