"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "@/lib/toast";
import { Input } from "@/components/ui/input";

type RankingSettings = {
  freshnessWeight: number;
  boostWeight: number;
  ageMatchWeight: number;
  proximityWeight: number;
  popularityWeight: number;
};

const FIELDS: { key: keyof RankingSettings; label: string; description: string }[] = [
  { key: "freshnessWeight",  label: "Freshness",  description: "Вес свежести контента (новые публикации выше)" },
  { key: "boostWeight",      label: "Boost",      description: "Вес коммерческого буста" },
  { key: "ageMatchWeight",   label: "Age match",  description: "Вес совпадения возрастной группы" },
  { key: "proximityWeight",  label: "Proximity",  description: "Вес близости к пользователю" },
  { key: "popularityWeight", label: "Popularity", description: "Вес популярности (просмотры, сохранения)" },
];

export default function RankingWeightsPage() {
  const [settings, setSettings] = useState<RankingSettings>({
    freshnessWeight: 1,
    boostWeight: 1,
    ageMatchWeight: 1,
    proximityWeight: 1,
    popularityWeight: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ranking", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.ranking);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ranking", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ranking", data: settings }),
      });
      if (res.ok) toast.success("Веса сохранены");
      else toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Ranking Weights</h1>
        <p className="text-sm text-gray-500 mt-1">
          Веса факторов ранжирования. Значение 0 = фактор отключён, 1 = стандартный вес.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Загрузка...</div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
          {FIELDS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.1}
                  value={settings[key]}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))}
                  className="w-32 accent-[#EF8759]"
                />
                <Input
                  type="number"
                  min={0}
                  max={3}
                  step={0.1}
                  value={settings[key]}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))}
                  className="h-9 w-16 px-2 py-0 text-center text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving || loading}
        className="h-10 px-6 rounded-2xl bg-[#EF8759] text-white text-sm font-semibold hover:bg-[#e8784a] disabled:opacity-40 transition-colors"
      >
        {saving ? "Сохранение..." : "Сохранить"}
      </button>
    </div>
  );
}
