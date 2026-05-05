"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createImportSourceAction } from "../../actions";
import { getProductionParsers } from "@/server/modules/import/parsers/parser-definitions";
import { useAutoSlug } from "@/hooks/useAutoSlug";
import { normalizeTaxonomySlug, transliterateToSlug } from "@/lib/taxonomy/transliterateToSlug";

const CREATE_SOURCE_MODAL_PARAM = "createSource";

const PLACEHOLDERS = {
  PLACE: {
    name: "Например: Afisha.by — Места",
    slug: "afisha-by-places",
    baseUrl: "https://example.com/places",
  },
  EVENT: {
    name: "Например: Afisha.by — События",
    slug: "afisha-by-events",
    baseUrl: "https://example.com/events",
  },
} as const;

export function CreateSourceModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    source: name,
    slug,
    setSource: setName,
    setSlug,
    hydrate,
    isValueEditedManually: isSlugEditedManually,
  } = useAutoSlug("", "", { mode: "create" });
  const [entityType, setEntityType] = useState<"PLACE" | "EVENT">("PLACE");
  const [baseUrl, setBaseUrl] = useState("");
  const [parserKey, setParserKey] = useState("");
  const [notes, setNotes] = useState("");

  const parsers = getProductionParsers();
  const filteredParsers = parsers.filter((p) => p.entityType === entityType);
  const placeholders = PLACEHOLDERS[entityType];
  const open = searchParams.get(CREATE_SOURCE_MODAL_PARAM) === "1";

  function setModalOpen(nextOpen: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextOpen) {
      params.set(CREATE_SOURCE_MODAL_PARAM, "1");
    } else {
      params.delete(CREATE_SOURCE_MODAL_PARAM);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function resetForm() {
    hydrate("", "");
    setEntityType("PLACE");
    setBaseUrl("");
    setParserKey("");
    setNotes("");
    setError(null);
  }

  useEffect(() => {
    if (!open && !loading) {
      resetForm();
    }
  }, [open, loading]);

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
        resetForm();
        setModalOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="rounded px-3 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition"
      >
        + Добавить источник
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Новый источник импорта</h2>
              <button
                onClick={() => setModalOpen(false)}
                disabled={loading}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Название <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={placeholders.name}
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              {/* Slug */}
              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="block text-xs font-medium text-gray-700">
                    Slug <span className="text-red-500">*</span>
                  </label>
                  {isSlugEditedManually && (
                    <button
                      type="button"
                      onClick={() => setSlug(transliterateToSlug(name))}
                      className="text-xs font-medium text-blue-600 transition hover:text-blue-700"
                    >
                      Сгенерировать заново
                    </button>
                  )}
                </div>
                <input
                  value={slug}
                  onChange={(e) => setSlug(normalizeTaxonomySlug(e.target.value))}
                  placeholder={placeholders.slug}
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
                  placeholder={placeholders.baseUrl}
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
                      {p.label}
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
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={loading}
                  className="rounded-lg px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition disabled:opacity-40"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
