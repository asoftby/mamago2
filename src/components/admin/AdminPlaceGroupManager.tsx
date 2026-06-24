"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

type AdminPlaceOption = {
  id: string;
  title: string;
  shortAddress?: string | null;
  formattedAddr?: string | null;
  status?: string;
  ownerBusinessId?: string | null;
  ownerBusiness?: { name?: string | null } | null;
};

type AdminPlaceGroupManagerProps = {
  currentPlaceId: string;
  currentGroupId?: string | null;
};

export function AdminPlaceGroupManager({
  currentPlaceId,
  currentGroupId,
}: AdminPlaceGroupManagerProps) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<AdminPlaceOption[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<AdminPlaceOption[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedQuery = query.trim();
  const isSearchMode = normalizedQuery.length >= 2;

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentGroup() {
      if (!currentGroupId) {
        setSelectedPlaces([]);
        setIsInitialLoading(false);
        return;
      }

      try {
        setIsInitialLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/place-groups/${currentGroupId}/places`);
        if (!response.ok) {
          throw new Error("Не удалось загрузить текущие связанные места");
        }

        const payload = (await response.json()) as { places?: AdminPlaceOption[] };
        if (!isMounted) return;

        setSelectedPlaces(
          (payload.places ?? []).filter((place) => place.id !== currentPlaceId),
        );
      } catch (loadError) {
        console.error("Failed to load admin place group:", loadError);
        if (isMounted) {
          setError("Не удалось загрузить текущие связанные места");
        }
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    }

    void loadCurrentGroup();

    return () => {
      isMounted = false;
    };
  }, [currentGroupId, currentPlaceId]);

  useEffect(() => {
    let isMounted = true;

    async function loadPlaces() {
      try {
        setIsSearching(true);
        setError(null);

        const params = new URLSearchParams({ excludeId: currentPlaceId });
        if (normalizedQuery.length >= 2) {
          params.set("q", normalizedQuery);
        }

        const response = await fetch(`/api/admin/places/search?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Не удалось загрузить список мест");
        }

        const payload = (await response.json()) as { places?: AdminPlaceOption[] };
        if (isMounted) {
          setPlaces(payload.places ?? []);
        }
      } catch (loadError) {
        console.error("Failed to load admin places:", loadError);
        if (isMounted) {
          setError("Не удалось загрузить список мест");
        }
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    }

    void loadPlaces();

    return () => {
      isMounted = false;
    };
  }, [currentPlaceId, normalizedQuery]);

  const selectedIdSet = useMemo(
    () => new Set(selectedPlaces.map((place) => place.id)),
    [selectedPlaces],
  );

  const visiblePlaces = useMemo(() => {
    const merged = [...selectedPlaces];

    for (const place of places) {
      if (!merged.some((item) => item.id === place.id)) {
        merged.push(place);
      }
    }

    return merged;
  }, [places, selectedPlaces]);

  async function saveSelection(nextSelectedPlaces: AdminPlaceOption[]) {
    const previousSelectedPlaces = selectedPlaces;

    setSelectedPlaces(nextSelectedPlaces);
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/places/${currentPlaceId}/group`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relatedPlaceIds: nextSelectedPlaces.map((place) => place.id),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Не удалось сохранить связанные места");
      }
    } catch (saveError) {
      console.error("Failed to save admin place group:", saveError);
      setSelectedPlaces(previousSelectedPlaces);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить связанные места",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(place: AdminPlaceOption) {
    if (isSaving) return;

    const nextSelectedPlaces = selectedIdSet.has(place.id)
      ? selectedPlaces.filter((item) => item.id !== place.id)
      : [...selectedPlaces, place];

    await saveSelection(nextSelectedPlaces);
  }

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-gray-900">Связанные места</h2>
        <p className="text-sm text-gray-600">
          Выберите места, которые нужно показать рядом с этой локацией.
        </p>
        <p className="text-xs text-gray-500">
          Админ может связывать места любых владельцев.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти место по названию или адресу"
          className="pl-9"
        />
      </div>

      <div className="mt-4 rounded-2xl border">
        {isInitialLoading || isSearching ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isInitialLoading ? "Загрузка связанных мест..." : "Загрузка списка мест..."}
          </div>
        ) : visiblePlaces.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">
            {isSearchMode
              ? "Ничего не найдено."
              : "Найдите место, которое нужно показать рядом с этой локацией."}
          </div>
        ) : (
          <div className="divide-y">
            {visiblePlaces.map((place) => (
              <label
                key={place.id}
                className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
              >
                <Checkbox
                  checked={selectedIdSet.has(place.id)}
                  onCheckedChange={() => void handleToggle(place)}
                  disabled={isSaving}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{place.title}</p>
                  <p className="text-xs text-gray-500">
                    {place.shortAddress || place.formattedAddr || "Без адреса"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {place.ownerBusiness?.name
                      ? `${place.ownerBusiness.name} · ${place.status ?? "UNKNOWN"}`
                      : place.status ?? "UNKNOWN"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {selectedPlaces.length > 0 ? (
        <p className="mt-3 text-sm text-gray-500">Связано мест: {selectedPlaces.length}</p>
      ) : null}
    </section>
  );
}
