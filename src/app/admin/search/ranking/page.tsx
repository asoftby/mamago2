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
  RotateCcw,
  Save,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch("/api/admin/search/ranking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nearbyBoost: settings.nearbyBoost,
          freshnessBoost: settings.freshnessBoost,
          popularityBoost: settings.popularityBoost,
          partnerBoost: settings.partnerBoost,
          ageBoost: settings.ageBoost,
          cityBoost: settings.cityBoost,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSettings(result.data.settings);
        setHasChanges(false);
      } else {
        alert(result.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Reset all ranking weights to default values?")) return;

    setSaving(true);
    try {
      const response = await fetch("/api/admin/search/ranking?action=reset", {
        method: "POST",
      });

      const result = await response.json();

      if (result.success) {
        setSettings(result.data.settings);
        setHasChanges(false);
      } else {
        alert(result.error || "Failed to reset settings");
      }
    } catch (error) {
      console.error("Failed to reset settings:", error);
      alert("Failed to reset settings");
    } finally {
      setSaving(false);
    }
  }

  function handleChange(key: string, value: number) {
    if (!settings) return;

    setSettings({
      ...settings,
      [key]: value,
    });
    setHasChanges(true);
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Ranking Settings</h2>
            <p className="text-gray-600 mt-1">
              Configure search and recommendation ranking weights
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saving}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Info className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-purple-900">
                AI Recommendation Tuning
              </h3>
              <p className="text-sm text-purple-700 mt-1">
                Adjust these weights to control how search results and recommendations are
                ranked. Higher values give more importance to that factor. Set to 0 to
                disable a factor completely.
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
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
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

                {/* Slider */}
                <div className="space-y-2">
                  <input
                    type="range"
                    min={boost.min}
                    max={boost.max}
                    step={boost.step}
                    value={value}
                    onChange={(e) => handleChange(boost.key, parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, 
                        rgb(59, 130, 246) 0%, 
                        rgb(59, 130, 246) ${value}%, 
                        rgb(229, 231, 235) ${value}%, 
                        rgb(229, 231, 235) 100%)`,
                    }}
                  />
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

        {/* Preview Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Current Configuration
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {RANKING_BOOSTS.map((boost) => {
              const value = settings[boost.key] as number;
              return (
                <div key={boost.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{boost.label}</span>
                  <span className="text-sm font-bold text-gray-900">{value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">
            How Ranking Works
          </h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p>
              • <strong>Nearby Boost:</strong> Content closer to user&apos;s location ranks
              higher
            </p>
            <p>
              • <strong>Freshness Boost:</strong> Recently added or updated content ranks
              higher
            </p>
            <p>
              • <strong>Popularity Boost:</strong> Content with more views and bookings
              ranks higher
            </p>
            <p>
              • <strong>Partner Boost:</strong> Verified partner content ranks higher
            </p>
            <p>
              • <strong>Age Matching:</strong> Content matching child&apos;s age ranks higher
            </p>
            <p>
              • <strong>City Matching:</strong> Content in user&apos;s city ranks higher
            </p>
          </div>
        </div>

        {/* Changes Warning */}
        {hasChanges && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
            <p className="text-sm text-yellow-800">
              ⚠️ You have unsaved changes. Click &quot;Save Changes&quot; to apply them.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          border: 3px solid rgb(59, 130, 246);
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          border: 3px solid rgb(59, 130, 246);
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </SearchLayout>
  );
}
