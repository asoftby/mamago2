"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "@/lib/toast";
import { Toggle } from "@/components/ui/Toggle";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type StoryIntent = {
  id: string;
  intent: string;
  title: string;
  enabled: boolean;
  order: number;
  itemLimit: number;
  allowedTypes: string[];
};

const CONTENT_TYPES = ["events", "offers", "places"];

export default function StoriesIntentsPage() {
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
        toast.success("Сохранено");
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

  const toggleType = (intent: StoryIntent, type: string) => {
    const next = intent.allowedTypes.includes(type)
      ? intent.allowedTypes.filter((t) => t !== type)
      : [...intent.allowedTypes, type];
    update(intent.id, { allowedTypes: next });
  };

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Stories Intents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Управление интентами Stories: порядок, лимиты, типы контента.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Загрузка...</div>
      ) : (
        <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 w-32">Intent</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-20">Enabled</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-20">Order</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-24">Item limit</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Content types</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {intents.map((intent) => (
                <tr key={intent.id} className="hover:bg-gray-50/50 transition-colors">
                  {/* Intent slug */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {intent.intent}
                    </span>
                  </td>

                  {/* Title */}
                  <td className="px-4 py-3">
                    <Input
                      value={intent.title}
                      onChange={(e) => update(intent.id, { title: e.target.value })}
                      className="h-auto min-h-0 rounded-none border-0 border-b border-transparent bg-transparent px-0 py-0.5 text-sm text-gray-900 shadow-none transition-colors hover:border-gray-200 focus-visible:ring-0 focus-visible:border-gray-400"
                    />
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

                  {/* Item limit */}
                  <td className="px-4 py-3 text-center">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={intent.itemLimit}
                      onChange={(e) => update(intent.id, { itemLimit: Number(e.target.value) })}
                      className="h-9 w-14 px-2 py-0 text-center text-sm"
                    />
                  </td>

                  {/* Allowed content types */}
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {CONTENT_TYPES.map((type) => (
                        <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={intent.allowedTypes.includes(type)}
                            onCheckedChange={() => toggleType(intent, type)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs text-gray-600">{type}</span>
                        </label>
                      ))}
                    </div>
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
