"use client";

import { useState } from "react";
import { createImportSourceAction } from "../../actions";

export function SeedMockSourceButton() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading || done) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createImportSourceAction({
        name: "Mock Place Source",
        slug: "mock-place-source",
        type: "MANUAL",
        parserKey: "mock-place",
        defaultEntity: "PLACE",
        notes: "Dev-only mock source для тестирования pipeline",
      });
      if (res.success) {
        setDone(true);
        // Перезагрузить страницу чтобы показать новый источник
        window.location.reload();
      } else {
        setError(res.error ?? "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center rounded px-3 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
      >
        {loading ? "Создание…" : "+ Добавить mock-источник"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
