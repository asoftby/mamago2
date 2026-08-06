"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "@/lib/toast";
import { Toggle } from "@/components/ui/Toggle";
import { Input } from "@/components/ui/input";

type StoryIntent = {
  id: string;
  intent: string;
  title: string;
  enabled: boolean;
  order: number;
  itemLimit: number;
  allowedTypes: string[];
  updatedAt: string;
};

const INTENT_META: Record<string, { description: string }> = {
  today: { description: "Активности текущего календарного дня в timezone города." },
  tomorrow: { description: "Активности следующего календарного дня по календарной границе." },
  weekend: { description: "Ближайший актуальный диапазон субботы и воскресенья." },
  breaking_news: { description: "Срочные редакционные публикации, которые выводятся с повышенным приоритетом." },
  free: { description: "Ближайшие бесплатные события." },
};

export function StoryIntentRulesPanel() {
  const [intents, setIntents] = useState<StoryIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ranking", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setIntents(data.intents);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (intent: StoryIntent) => {
    setSaving(intent.id);
    try {
      const res = await fetch("/api/admin/ranking", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "intent", data: intent }),
      });
      if (res.ok) {
        const updated = await res.json();
        setIntents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        toast.success("Сохранено");
      } else if (res.status === 409) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Настройка изменена другим администратором, обновите страницу");
        await load();
      } else {
        toast.error("Ошибка сохранения");
      }
    } finally {
      setSaving(null);
    }
  };

  const update = (id: string, patch: Partial<StoryIntent>) => {
    setIntents((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Правила ранжирования</h2>
        <p className="text-sm text-gray-500 mt-1">
          Реальные публичные блоки Stories. Их порядок соответствует главной; Offers добавляются только через ручные placements.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Загрузка...</div>
      ) : (
        <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-full px-4 py-3 text-left font-medium text-gray-500">Правило</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-24">Активно</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-24">Позиция</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {intents.map((intent) => (
                <tr key={intent.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="w-full px-4 py-3">
                    <Input
                      value={intent.title}
                      onChange={(e) => update(intent.id, { title: e.target.value })}
                      className="h-auto min-h-0 rounded-none border-0 border-b border-transparent bg-transparent px-0 py-0.5 text-sm text-gray-900 shadow-none transition-colors hover:border-gray-200 focus-visible:ring-0 focus-visible:border-gray-400"
                    />
                    <p className="mt-1 text-xs text-gray-500">{INTENT_META[intent.intent]?.description}</p>
                    <span className="mt-1 inline-block font-mono text-[10px] text-gray-400">{intent.intent}</span>
                  </td>
                  {/* Enabled toggle */}
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      checked={intent.enabled}
                      onChange={(val) => update(intent.id, { enabled: val })}
                      aria-label={intent.enabled ? "Выключить" : "Включить"}
                    />
                  </td>

                  {/* Order */}
                  <td className="px-4 py-3 text-center">
                    <Input
                      type="number"
                      min={0}
                      value={intent.order}
                      onChange={(e) => update(intent.id, { order: Number(e.target.value) })}
                      className="h-9 w-14 px-2 py-0 text-center text-sm"
                    />
                  </td>

                  {/* Save */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => save(intent)}
                      disabled={saving === intent.id}
                      className="text-xs font-medium text-[#EF8759] hover:text-[#e8784a] disabled:opacity-40 transition-colors"
                    >
                      {saving === intent.id ? "..." : "Сохранить"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
