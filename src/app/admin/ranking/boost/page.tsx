"use client";

import { useEffect, useState, useCallback } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { LoadingBlock } from "@/components/admin/ui/StateBlock";

type BoostSettings = {
  allowBoostInToday: boolean;
  allowBoostInNew: boolean;
  allowBoostInFree: boolean;
  maxBoostedItemsPerStory: number;
  maxBoostScore: number;
  repeatCooldown: number;
};

const TOGGLES: { key: keyof BoostSettings; label: string; description: string }[] = [
  { key: "allowBoostInToday", label: "Буст в «Сегодня»",    description: "Разрешить продвигаемый контент в интенте Today" },
  { key: "allowBoostInNew",   label: "Буст в «Новое»",      description: "Разрешить продвигаемый контент в интенте New" },
  { key: "allowBoostInFree",  label: "Буст в «Бесплатно»",  description: "Разрешить продвигаемый контент в интенте Free" },
];

const NUMBERS: { key: keyof BoostSettings; label: string; description: string }[] = [
  { key: "maxBoostedItemsPerStory", label: "Макс. буст-карточек в story",  description: "Максимум продвигаемых позиций на одну story" },
  { key: "maxBoostScore",           label: "Макс. boost score",            description: "Потолок скора буста при ранжировании" },
  { key: "repeatCooldown",          label: "Cooldown повтора (часы)",       description: "Через сколько часов один и тот же буст может появиться снова" },
];

export default function BoostRulesPage() {
  const [settings, setSettings] = useState<BoostSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ranking", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.boost);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Boost Rules</h1>
        <p className="text-sm text-gray-500 mt-1">
          Правила поведения коммерческого буста в Stories.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-900">
        <p className="font-medium">Только для чтения</p>
        <p className="mt-1 text-amber-800">
          Аудит подтвердил: реальный коммерческий буст (модель <code>Boost</code>, offer-промо в
          discovery-лентах) не использует эти поля — они сохраняются в базе, но нигде не читаются
          production-кодом. Редактирование отключено до завершения редизайна раздела Ranking.
        </p>
      </div>

      {loading || !settings ? (
        <LoadingBlock title="Загрузка настроек буста..." compact />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
            {TOGGLES.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                </div>
                <Toggle
                  checked={settings[key] as boolean}
                  onChange={() => {}}
                  disabled
                  aria-label={label}
                />
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
            {NUMBERS.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                </div>
                <div className="shrink-0 text-sm font-semibold text-gray-500 tabular-nums">
                  {settings[key] as number}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
