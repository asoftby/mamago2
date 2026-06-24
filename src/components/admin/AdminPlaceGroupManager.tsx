"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [searchResults, setSearchResults] = useState<AdminPlaceOption[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<AdminPlaceOption[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

    async function searchPlaces() {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        setIsSearching(true);
        const params = new URLSearchParams({
          q: trimmed,
          excludeId: currentPlaceId,
        });
        const response = await fetch(`/api/admin/places/search?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Не удалось выполнить поиск");
        }

        const payload = (await response.json()) as { places?: AdminPlaceOption[] };
        if (isMounted) {
          setSearchResults(payload.places ?? []);
        }
      } catch (searchError) {
        console.error("Failed to search places for admin group:", searchError);
        if (isMounted) {
          setError("Не удалось выполнить поиск мест");
        }
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    }

    void searchPlaces();

    return () => {
      isMounted = false;
    };
  }, [currentPlaceId, query]);

  const selectedIdSet = useMemo(
    () => new Set(selectedPlaces.map((place) => place.id)),
    [selectedPlaces],
  );

  function togglePlace(place: AdminPlaceOption) {
    setSuccessMessage(null);
    setError(null);
    setSelectedPlaces((current) => {
      if (current.some((item) => item.id === place.id)) {
        return current.filter((item) => item.id !== place.id);
      }
      return [...current, place];
    });
  }

  async function handleSave() {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/places/${currentPlaceId}/group`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          relatedPlaceIds: selectedPlaces.map((place) => place.id),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Не удалось сохранить связанные места");
      }

      setSuccessMessage("Связанные места сохранены.");
    } catch (saveError) {
      console.error("Failed to save admin place group:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить связанные места",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-gray-900">Связанные места</h2>
        <p className="text-sm text-gray-600">
          Выберите места, которые нужно показать рядом с этой локацией.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {successMessage}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти место по названию или адресу"
            className="pl-9"
          />
        </div>

        <div className="rounded-2xl border">
          {isInitialLoading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка текущих связей...
            </div>
          ) : (
            <div className="p-4">
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-900">Выбрано</p>
                <p className="text-xs text-gray-500">
                  {selectedPlaces.length > 0
                    ? `Связано мест: ${selectedPlaces.length}`
                    : "Сейчас это место не связано с другими местами."}
                </p>
              </div>

              {selectedPlaces.length > 0 ? (
                <div className="space-y-2">
                  {selectedPlaces.map((place) => (
                    <label
                      key={place.id}
                      className="flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => togglePlace(place)}
                        disabled={isSaving}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{place.title}</p>
                        <p className="text-xs text-gray-500">
                          {place.shortAddress || place.formattedAddr || "Без адреса"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-2xl border">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-medium text-gray-900">Результаты поиска</p>
            <p className="text-xs text-gray-500">
              Админ может связывать места любых владельцев.
            </p>
          </div>

          {query.trim().length < 2 ? (
            <div className="px-4 py-6 text-sm text-gray-500">
              Введите минимум 2 символа, чтобы найти места.
            </div>
          ) : isSearching ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ищем места...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">Ничего не найдено.</div>
          ) : (
            <div className="divide-y">
              {searchResults.map((place) => (
                <label
                  key={place.id}
                  className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedIdSet.has(place.id)}
                    onCheckedChange={() => togglePlace(place)}
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

        <div className="flex justify-end">
          <Button onClick={() => void handleSave()} disabled={isSaving || isInitialLoading}>
            {isSaving ? "Сохраняем..." : "Сохранить связанные места"}
          </Button>
        </div>
      </div>
    </section>
  );
}
