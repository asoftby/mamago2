"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createImportSourceAction } from "../../actions";
import { getProductionParsers, getAllParsers } from "@/server/modules/import/parsers/parser-definitions";

interface Props {
  devMode?: boolean;
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function CreateSourceModal({ devMode = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [entityType, setEntityType] = useState<"PLACE" | "EVENT">("PLACE");
  const [baseUrl, setBaseUrl] = useState("");
  const [parserKey, setParserKey] = useState("");
  const [notes, setNotes] = useState("");

  const parsers = devMode ? getAllParsers() : getProductionParsers();
  const filteredParsers = parsers.filter((p) => p.entityType === entityType);

  function handleNameChange(v: string) {
    setName(v);
    if (!slugManual) setSlug(slugify(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createImportSourceAction({
        name: name.trim(),
        slug: slug.trim(),
        type: "WEBSITE",
        baseUrl: baseUrl.trim() || undefined,
        parserKey: parserKey || undefined,
        defaultEntity: entityType,
        notes: notes.trim() || undefined,
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
        className="rounded px-3 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition"
      >
        + Добавить источник
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Новый источник импорта</h2>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Название <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Afisha.by — Места"
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Slug <span className="text-red-500">*</span>
            </label>
            <input
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
              placeholder="afisha-by-places"
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <p className="text-xs text-gray-400 mt-0.5">Уникальный идентификатор, только a-z, 0-9, дефис</p>
          </div>

          {/* Entity type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Тип контента</label>
            <div className="flex gap-3">
              {(["PLACE", "EVENT"] as const).map((t) => (
                <label key={t} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm transition ${entityType === t ? "border-blue-400 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                  <input type="radio" name="entityType" value={t} checked={entityType === t}
                    onChange={() => { setEntityType(t); setParserKey(""); }} className="sr-only" />
                  {t === "PLACE" ? "Места" : "События"}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">URL источника</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://example.com/places"
              type="url"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Парсер</label>
            <select
              value={parserKey}
              onChange={(e) => setParserKey(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">— выбрать парсер —</option>
              {filteredParsers.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}{p.devOnly ? " [dev]" : ""}
                </option>
              ))}
            </select>
            {filteredParsers.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                Для выбранного типа пока нет доступных парсеров.
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Заметки (необязательно)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Описание источника, особенности..."
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
            />
          </div>

          {error && (
            <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading || !name.trim() || !slug.trim()}
              className="rounded-lg px-5 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
              {loading ? "Создание…" : "Создать источник"}
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
