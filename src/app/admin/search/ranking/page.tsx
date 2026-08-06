"use client";

import { useEffect, useState } from "react";
import { SearchLayout } from "@/components/admin/search/SearchLayout";
import {
  MapPin,
  Sparkles,
  TrendingUp,
  Award,
  Users,
  Building2,
} from "lucide-react";
import type { SearchRankingSettings } from "@/types/search-ranking";
import { RANKING_BOOSTS } from "@/types/search-ranking";

const ICONS = {
  MapPin,
  Sparkles,
  TrendingUp,
  Award,
  Users,
  Building2,
};

export default function RankingPage() {
  const [settings, setSettings] = useState<SearchRankingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const response = await fetch("/api/admin/search/ranking");
      const result = await response.json();
      if (result.success) {
        setSettings(result.data.settings);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  }

  function getBoostColor(value: number): string {
    if (value >= 70) return "from-green-500 to-emerald-500";
    if (value >= 40) return "from-blue-500 to-cyan-500";
    if (value >= 20) return "from-yellow-500 to-orange-500";
    return "from-gray-400 to-gray-500";
  }

  function getBoostLabel(value: number): string {
    if (value === 0) return "Disabled";
    if (value <= 20) return "Low";
    if (value <= 40) return "Medium";
    if (value <= 70) return "High";
    return "Maximum";
  }

  if (loading) {
    return (
      <SearchLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      </SearchLayout>
    );
  }

  if (!settings) {
    return (
      <SearchLayout>
        <div className="text-center py-12">
          <p className="text-red-600">Failed to load settings</p>
        </div>
      </SearchLayout>
    );
  }

  return (
    <SearchLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ranking Settings</h2>
          <p className="text-gray-600 mt-1">
            Search and recommendation ranking weights
          </p>
        </div>

        {/* Read-only warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Award className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Только для чтения
              </h3>
              <p className="text-sm text-amber-800 mt-1">
                Аудит подтвердил: реальный поиск использует статические коэффициенты из
                <code className="mx-1 px-1 py-0.5 rounded bg-amber-100">src/lib/search/constants.ts</code>
                (SEARCH_BOOST), а не эти поля — они сохраняются в базе, но нигде не читаются
                production-кодом. Редактирование отключено до завершения редизайна раздела Ranking.
              </p>
            </div>
          </div>
        </div>

        {/* Ranking Boosts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {RANKING_BOOSTS.map((boost) => {
            const Icon = ICONS[boost.icon as keyof typeof ICONS];
            const value = settings[boost.key] as number;
            const color = getBoostColor(value);
            const label = getBoostLabel(value);

            return (
              <div
                key={boost.key}
                className="bg-white rounded-2xl border border-gray-200 p-6"
              >
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 bg-gradient-to-br ${color} rounded-xl`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {boost.label}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{boost.description}</p>
                  </div>
                </div>

                {/* Value Display */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Weight</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      value === 0
                        ? "bg-gray-100 text-gray-600"
                        : value >= 70
                        ? "bg-green-100 text-green-700"
                        : value >= 40
                        ? "bg-blue-100 text-blue-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {label}
                    </span>
                    <span className="text-2xl font-bold text-gray-900">{value}</span>
                  </div>
                </div>

                {/* Static bar (read-only) */}
                <div className="space-y-2">
                  <div className="w-full h-2 bg-gray-200 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg bg-blue-500"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0 (Off)</span>
                    <span>50 (Balanced)</span>
                    <span>100 (Max)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SearchLayout>
  );
}
