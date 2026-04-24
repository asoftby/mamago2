"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

type AdminCityRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isVisibleInCityFilter: boolean;
  priority: number;
  eventsCount: number;
  placesCount: number;
};

export default function CitiesPage() {
  const [cities, setCities] = useState<AdminCityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/taxonomy/cities?details=1");
        if (!response.ok) throw new Error("Failed to fetch cities");
        const data = (await response.json()) as AdminCityRow[];
        setCities(data);
      } catch {
        toast.error("Не удалось загрузить города");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const patchCity = async (
    id: string,
    patch: Partial<Pick<AdminCityRow, "isActive" | "isVisibleInCityFilter" | "priority">>,
  ) => {
    setSavingId(id);
    try {
      const response = await fetch(`/api/admin/taxonomy/cities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("Failed to update city");

      setCities((prev) =>
        prev.map((city) =>
          city.id === id
            ? {
                ...city,
                ...patch,
              }
            : city,
        ),
      );
    } catch {
      toast.error("Не удалось обновить город");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 md:text-xl">Города</h1>
        <p className="mt-1 text-sm text-gray-600">
          Здесь управляется city selector и доступность городов в публичном каталоге.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold md:text-base">
            Список городов ({cities.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="grid grid-cols-[minmax(180px,1.2fr)_minmax(160px,1fr)_100px_170px_110px_110px] gap-4 border-b bg-gray-50 p-4 text-sm font-medium text-gray-700">
              <div>Город</div>
              <div>Slug</div>
              <div>Активен</div>
              <div>Показывать в фильтре</div>
              <div>События</div>
              <div>Места</div>
            </div>

            <div className="divide-y divide-gray-200">
              {cities.map((city) => {
                const disabled = savingId === city.id;
                return (
                  <div
                    key={city.id}
                    className="grid grid-cols-[minmax(180px,1.2fr)_minmax(160px,1fr)_100px_170px_110px_110px] items-center gap-4 p-4 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{city.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-gray-500">priority</span>
                        <Input
                          type="number"
                          value={city.priority}
                          className="h-8 w-20"
                          onChange={(e) => {
                            const next = Number(e.target.value || 0);
                            setCities((prev) =>
                              prev.map((row) =>
                                row.id === city.id ? { ...row, priority: next } : row,
                              ),
                            );
                          }}
                          onBlur={() => void patchCity(city.id, { priority: city.priority })}
                          disabled={disabled}
                        />
                      </div>
                    </div>

                    <div className="text-gray-600">{city.slug}</div>

                    <div>
                      <Switch
                        checked={city.isActive}
                        onCheckedChange={(checked) =>
                          void patchCity(city.id, { isActive: checked })
                        }
                        disabled={disabled}
                      />
                    </div>

                    <div>
                      <Switch
                        checked={city.isVisibleInCityFilter}
                        onCheckedChange={(checked) =>
                          void patchCity(city.id, {
                            isVisibleInCityFilter: checked,
                          })
                        }
                        disabled={disabled}
                      />
                    </div>

                    <div className="font-medium text-gray-900">{city.eventsCount}</div>
                    <div className="font-medium text-gray-900">{city.placesCount}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
