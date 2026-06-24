"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CONTENT_STATUS_META, contentStatusPublicationPillClass } from "@/lib/content-status-meta";

type RelatedPlaceOption = {
  id: string;
  title: string;
  shortAddress?: string | null;
  placeGroupId?: string | null;
  status?: string;
};

function getPlaceStatusPresentation(status?: string) {
  const normalizedStatus = status ?? "DRAFT";
  const meta = CONTENT_STATUS_META[normalizedStatus as keyof typeof CONTENT_STATUS_META];

  if (meta) {
    return {
      label: meta.label,
      className: contentStatusPublicationPillClass(normalizedStatus as keyof typeof CONTENT_STATUS_META),
    };
  }

  return {
    label: normalizedStatus,
    className: "border-stone-200 bg-stone-50 text-stone-600",
  };
}

type PlaceGroupSelectorProps = {
  currentPlaceId?: string;
  currentGroupId?: string | null;
  onGroupIdChange?: (groupId: string | null) => void;
  selectedPlaceIds?: string[];
  onSelectedPlaceIdsChange?: (placeIds: string[]) => void;
  className?: string;
  disabled?: boolean;
  emptyStateDescription?: string;
};

export function PlaceGroupSelector({
  currentPlaceId,
  currentGroupId,
  onGroupIdChange,
  selectedPlaceIds: selectedPlaceIdsProp,
  onSelectedPlaceIdsChange,
  className,
  disabled = false,
  emptyStateDescription = "Пока нет других мест для связи.",
}: PlaceGroupSelectorProps) {
  const [places, setPlaces] = useState<RelatedPlaceOption[]>([]);
  const [selectedPlaceIdsState, setSelectedPlaceIdsState] = useState<string[]>(
    selectedPlaceIdsProp ?? [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(5);
  const isDeferredMode = !currentPlaceId;

  const selectedPlaceIds = selectedPlaceIdsProp ?? selectedPlaceIdsState;

  useEffect(() => {
    if (selectedPlaceIdsProp) {
      setSelectedPlaceIdsState(selectedPlaceIdsProp);
    }
  }, [selectedPlaceIdsProp]);

  useEffect(() => {
    let isMounted = true;

    async function loadPlaces() {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (currentPlaceId) {
          params.set("excludeId", currentPlaceId);
        }
        const response = await fetch(`/api/business/places/list?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Не удалось загрузить список мест");
        }

        const data = (await response.json()) as { places?: RelatedPlaceOption[] };
        if (!isMounted) return;

        const nextPlaces = data.places ?? [];
        setPlaces(nextPlaces);

        if (selectedPlaceIdsProp) {
          setSelectedPlaceIdsState(
            selectedPlaceIdsProp.filter((placeId) =>
              nextPlaces.some((place) => place.id === placeId),
            ),
          );
        } else if (currentGroupId) {
          setSelectedPlaceIds(
            nextPlaces
              .filter((place) => place.placeGroupId === currentGroupId)
              .map((place) => place.id),
          );
        } else {
          setSelectedPlaceIds([]);
        }
      } catch (loadError) {
        console.error("Failed to load related places options:", loadError);
        if (isMounted) {
          setError("Не удалось загрузить список мест");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPlaces();

    return () => {
      isMounted = false;
    };
  }, [currentPlaceId, currentGroupId, selectedPlaceIdsProp]);

  const selectedCount = selectedPlaceIds.length;
  const selectedSet = useMemo(() => new Set(selectedPlaceIds), [selectedPlaceIds]);
  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length >= 2;
  const filteredPlaces = useMemo(() => {
    if (!isSearching) {
      return places;
    }

    return places.filter((place) => {
      const haystack = [place.title, place.shortAddress]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [isSearching, normalizedQuery, places]);
  const visiblePlaces = useMemo(
    () => (isSearching ? filteredPlaces : filteredPlaces.slice(0, visibleCount)),
    [filteredPlaces, isSearching, visibleCount],
  );
  const canShowMore = !isSearching && filteredPlaces.length > visibleCount;

  useEffect(() => {
    setVisibleCount(5);
  }, [query]);

  const setSelectedPlaceIds = (nextSelectedIds: string[]) => {
    setSelectedPlaceIdsState(nextSelectedIds);
    onSelectedPlaceIdsChange?.(nextSelectedIds);
  };

  async function saveSelection(nextSelectedIds: string[]) {
    if (isDeferredMode) {
      setSelectedPlaceIds(nextSelectedIds);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/business/places/${currentPlaceId!}/group`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ relatedPlaceIds: nextSelectedIds }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        placeGroupId?: string | null;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Не удалось сохранить связанные места");
      }

      setSelectedPlaceIds(nextSelectedIds);
      onGroupIdChange?.(payload.placeGroupId ?? null);
    } catch (saveError) {
      console.error("Failed to save related places:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить связанные места",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(placeId: string) {
    if (disabled || isSaving) return;

    const nextSelectedIds = selectedSet.has(placeId)
      ? selectedPlaceIds.filter((id) => id !== placeId)
      : [...selectedPlaceIds, placeId];

    await saveSelection(nextSelectedIds);
  }

  if (!isLoading && places.length === 0) {
    return null;
  }

  return (
    <section className={cn("rounded-3xl border bg-background p-6", className)}>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Связанные места</h3>
        <p className="text-sm text-muted-foreground">
          Выберите места, которые нужно показать рядом с этим местом.
        </p>
      </div>

      {disabled && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Изменение связанных мест недоступно, пока место находится на модерации.
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти место по названию или адресу"
          className="pl-9"
          disabled={disabled || isSaving}
        />
      </div>

      <div className="mt-4 rounded-2xl border">
        {isLoading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка мест...
          </div>
        ) : filteredPlaces.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            {isSearching ? "Ничего не найдено." : emptyStateDescription}
          </div>
        ) : (
          <div className="divide-y">
            {visiblePlaces.map((place) => (
              <label
                key={place.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors",
                  !disabled && !isSaving && "hover:bg-muted/40",
                  (disabled || isSaving) && "cursor-not-allowed opacity-70",
                )}
              >
                <Checkbox
                  checked={selectedSet.has(place.id)}
                  onCheckedChange={() => void handleToggle(place.id)}
                  disabled={disabled || isSaving}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Label className="cursor-pointer text-sm font-medium text-foreground">
                      {place.title}
                    </Label>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        getPlaceStatusPresentation(place.status).className,
                      )}
                    >
                      {getPlaceStatusPresentation(place.status).label}
                    </Badge>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {!isLoading && (
        <p className="mt-3 text-sm text-muted-foreground">
          {selectedCount > 0
            ? `Связано мест: ${selectedCount}`
            : "Сейчас это место не связано с другими местами."}
        </p>
      )}

      {canShowMore ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((current) => current + 5)}
            disabled={disabled || isSaving}
          >
            Показать ещё
          </Button>
        </div>
      ) : null}
    </section>
  );
}
