"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "@/lib/toast";
import { Toggle } from "@/components/ui/Toggle";
import { Input } from "@/components/ui/input";
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

const NUMBERS: { key: keyof BoostSettings; label: string; description: string; min: number; max: number }[] = [
  { key: "maxBoostedItemsPerStory", label: "Макс. буст-карточек в story",  description: "Максимум продвигаемых позиций на одну story", min: 0, max: 10 },
  { key: "maxBoostScore",           label: "Макс. boost score",            description: "Потолок скора буста при ранжировании", min: 0, max: 1000 },
  { key: "repeatCooldown",          label: "Cooldown повтора (часы)",       description: "Через сколько часов один и тот же буст может появиться снова", min: 0, max: 168 },
];

export default function BoostRulesPage() {
  const [settings, setSettings] = useState<BoostSettings>({
    allowBoostInToday: true,
    allowBoostInNew: true,
    allowBoostInFree: false,
    maxBoostedItemsPerStory: 2,
    maxBoostScore: 100,
    repeatCooldown: 24,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ranking", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "boost", data: settings }),
      });
      if (res.ok) toast.success("Настройки сохранены");
      else toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Boost Rules</h1>
        <p className="text-sm text-gray-500 mt-1">
          Правила поведения коммерческого буста в Stories.
        </p>
      </div>

      {loading ? (
        <LoadingBlock title="Загрузка настроек буста..." compact />
      ) : (
        <div className="space-y-4">
          {/* Toggles */}
          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
            {TOGGLES.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                </div>
                <Toggle
                  checked={settings[key] as boolean}
                  onChange={(val) => setSettings((s) => ({ ...s, [key]: val }))}
                  aria-label={label}
                />
              </div>
            ))}
          </div>

          {/* Number inputs */}
          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
            {NUMBERS.map(({ key, label, description, min, max }) => (
              <div key={key} className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                </div>
                <Input
                  type="number"
                  min={min}
                  max={max}
                  value={settings[key] as number}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))}
                  className="h-9 w-20 shrink-0 px-2 py-0 text-center text-sm"
                />
              </div>
            ))}
          </div>
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
