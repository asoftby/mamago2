"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

type PlaceOption = {
  id: string;
  title: string;
  shortAddress?: string | null;
  formattedAddr?: string | null;
};

/**
 * Minimal inline picker for assigning a Place to a DRAFT Offer that was
 * imported without one (Phoenix legacy import). Reuses the existing
 * PATCH /api/business/offers/[id] selectedPlace path — the same
 * Place/owner/city logic a normal reassignment goes through, no new
 * server-side behavior.
 */
export function AssignOfferPlaceControl({ offerId }: { offerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PlaceOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    setError(null);
    if (nextQuery.trim().length < 2) {
      setOptions([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/admin/places/search?q=${encodeURIComponent(nextQuery.trim())}`,
      );
      if (!response.ok) throw new Error("Не удалось найти места");
      const payload = (await response.json()) as { places?: PlaceOption[] };
      setOptions(payload.places ?? []);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Не удалось найти места");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAssign(placeId: string) {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/business/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedPlace: { id: placeId } }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось назначить место");
      setOpen(false);
      setQuery("");
      setOptions([]);
      router.refresh();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Не удалось назначить место");
    } finally {
      setIsSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-blue-600 hover:underline"
      >
        Назначить место
      </button>
    );
  }

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={query}
          onChange={(event) => void handleSearch(event.target.value)}
          placeholder="Найти место…"
          className="h-8 w-56 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setQuery("");
            setOptions([]);
            setError(null);
          }}
          className="text-xs text-gray-500 hover:underline"
        >
          Отмена
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {(isSearching || options.length > 0) && (
        <div className="absolute z-10 mt-1 max-h-56 w-72 overflow-auto rounded-md border bg-white shadow-lg">
          {isSearching ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Поиск…
            </div>
          ) : (
            options.map((place) => (
              <button
                key={place.id}
                type="button"
                disabled={isSaving}
                onClick={() => void handleAssign(place.id)}
                className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {place.title}
                <span className="block truncate text-xs text-gray-500">
                  {place.shortAddress || place.formattedAddr || ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
