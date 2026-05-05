"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateImportSourceAction } from "../../actions";
import { getProductionParsers } from "@/server/modules/import/parsers/parser-definitions";
import type { ImportSource } from "@prisma/client";

interface Props {
  source: Pick<ImportSource, "id" | "name" | "baseUrl" | "parserKey" | "defaultEntity" | "status" | "notes" | "crawlMaxPages" | "crawlMaxDetailLinks" | "crawlMaxRecords">;
}

export function EditSourceModal({ source }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(source.name);
  const [baseUrl, setBaseUrl] = useState(source.baseUrl ?? "");
  const [parserKey, setParserKey] = useState(source.parserKey ?? "");
  const [entityType, setEntityType] = useState<"PLACE" | "EVENT">(
    (source.defaultEntity as "PLACE" | "EVENT") ?? "PLACE"
  );
  const [status, setStatus] = useState(source.status);
  const [notes, setNotes] = useState(source.notes ?? "");
  const [crawlMaxPages, setCrawlMaxPages] = useState(source.crawlMaxPages?.toString() ?? "");
  const [crawlMaxDetailLinks, setCrawlMaxDetailLinks] = useState(source.crawlMaxDetailLinks?.toString() ?? "");
  const [crawlMaxRecords, setCrawlMaxRecords] = useState(source.crawlMaxRecords?.toString() ?? "");

  const parsers = getProductionParsers();
  const filteredParsers = parsers.filter((p) => p.entityType === entityType);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await updateImportSourceAction(source.id, {
        name: name.trim(),
        baseUrl: baseUrl.trim() || undefined,
        parserKey: parserKey || undefined,
        defaultEntity: entityType,
        status: status as never,
        notes: notes.trim() || undefined,
        crawlMaxPages: crawlMaxPages ? parseInt(crawlMaxPages) : null,
        crawlMaxDetailLinks: crawlMaxDetailLinks ? parseInt(crawlMaxDetailLinks) : null,
        crawlMaxRecords: crawlMaxRecords ? parseInt(crawlMaxRecords) : null,
      });
      if (res.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
        title="Редактировать источник"
      >
        Изменить
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Редактировать источник</h2>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Название <span className="text-red-500">*</span>
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Тип контента</label>
            <div className="flex gap-3">
              {(["PLACE", "EVENT"] as const).map((t) => (
                <label key={t} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm transition ${entityType === t ? "border-blue-400 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                  <input type="radio" name="entityType" value={t} checked={entityType === t}
                    onChange={() => { setEntityType(t); setParserKey(""); }} className="sr-only" />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">URL источника</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} type="url"
              placeholder="https://example.com/places"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Парсер</label>
            <select value={parserKey} onChange={(e) => setParserKey(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">— выбрать парсер —</option>
              {filteredParsers.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Состояние источника</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="ACTIVE">Работает</option>
              <option value="PAUSED">Отключён</option>
              <option value="DISABLED">Выключен</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Заметки</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
          </div>

          {/* Crawl limits */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
            <div>
              <div className="text-xs font-medium text-gray-700 mb-0.5">Лимиты обхода</div>
              <div className="text-xs text-gray-400">Оставьте пустым, если парсер должен использовать стандартные ограничения</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Макс. страниц</label>
                <input
                  type="number" min="1" value={crawlMaxPages}
                  onChange={(e) => setCrawlMaxPages(e.target.value)}
                  placeholder="default"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Макс. карточек</label>
                <input
                  type="number" min="1" value={crawlMaxDetailLinks}
                  onChange={(e) => setCrawlMaxDetailLinks(e.target.value)}
                  placeholder="default"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Макс. записей</label>
                <input
                  type="number" min="1" value={crawlMaxRecords}
                  onChange={(e) => setCrawlMaxRecords(e.target.value)}
                  placeholder="default"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading || !name.trim()}
              className="rounded-lg px-5 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
              {loading ? "Сохранение…" : "Сохранить"}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
