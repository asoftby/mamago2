"use client";

import { useEffect, useState, useCallback } from "react";

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
  const [settings, setSettings] = useState<RankingSettings | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Ranking Weights</h1>
        <p className="text-sm text-gray-500 mt-1">
          Веса факторов ранжирования.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900">
        <p className="font-medium">Только для чтения</p>
        <p className="mt-1 text-amber-800">
          Аудит подтвердил: эти веса сохраняются в базе, но не используются ни одним
          production-алгоритмом ранжирования (проверено полным поиском по коду). Редактирование
          отключено, чтобы не вводить в заблуждение — реальные значения ниже показаны как есть, до
          завершения редизайна раздела Ranking.
        </p>
      </div>

      {loading || !settings ? (
        <div className="text-sm text-gray-400">Загрузка...</div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
          {FIELDS.map(({ key, label, description }) => (
            <div key={key} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
              </div>
              <div className="shrink-0 text-sm font-semibold text-gray-500 tabular-nums">
                {settings[key]}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
