"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, MapPin, Building2, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PlaceResult {
  id: string;
  title: string;
  address: string;
  fullAddress: string;
  cityId: string | null;
  cityName: string | null;
  citySlug: string | null;
  lat: number | null;
  lng: number | null;
  districtId: string | null;
  districtName: string | null;
  metroId: string | null;
  metroName: string | null;
  metroDistanceM: number | null;
  isOwn: boolean;
}

interface PlaceSearchAutocompleteProps {
  onPlaceSelect: (place: PlaceResult) => void;
  onCreateNew: (initialName: string) => void; // Передаем текущий query
  disabled?: boolean;
  placeholder?: string;
  selectedPlaceId?: string | null;
}

export function PlaceSearchAutocomplete({
  onPlaceSelect,
  onCreateNew,
  disabled = false,
  placeholder = "Найти место по названию или адресу",
  selectedPlaceId,
}: PlaceSearchAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Search places
  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setHasSearched(false);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(false);
    setIsOpen(true);
    
    try {
      const response = await fetch(
        `/api/business/places/search?q=${encodeURIComponent(searchQuery)}`
      );
      
      if (!response.ok) {
        throw new Error("Search failed");
      }
      
      const data = await response.json();
      setResults(data.results || []);
      setHasSearched(true);
      setIsOpen(true);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error("[PlaceSearchAutocomplete] Search error:", error);
      setResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(query.trim());
      }, 300);
    } else {
      setResults([]);
      setHasSearched(false);
      setIsOpen(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, searchPlaces]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    const totalItems = results.length + 1; // +1 for "Create new" option

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex === results.length) {
          // "Create new" option
          handleCreateNew();
        } else if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelectPlace(results[highlightedIndex]!);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleSelectPlace = (place: PlaceResult) => {
    onPlaceSelect(place);
    setQuery(place.title);
    setIsOpen(false);
    setHasSearched(false);
  };

  const handleCreateNew = () => {
    onCreateNew(query.trim()); // Передаем текущий query
    setIsOpen(false);
    setHasSearched(false);
  };

  const showDropdown = isOpen && query.trim().length >= 2;
  const showEmptyState = hasSearched && !isSearching && results.length === 0;

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full z-50 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div className="flex max-h-[320px] min-h-[168px] flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {isSearching && (
                <div className="flex min-h-[112px] items-center justify-center px-4 py-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Ищем места…</span>
                  </div>
                </div>
              )}

              {/* Search Results */}
              {!isSearching && results.length > 0 && (
                <div className="py-2">
                  <div className="px-4 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Результаты поиска
                  </div>
                {results.map((place, index) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => handleSelectPlace(place)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      highlightedIndex === index
                        ? "bg-primary/5"
                        : "hover:bg-gray-50",
                      selectedPlaceId === place.id && "bg-primary/10"
                    )}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {place.isOwn ? (
                        <Building2 className="h-5 w-5 text-primary" />
                      ) : (
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900">
                          {place.title}
                        </div>
                        {place.isOwn && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Моё место
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {place.cityName && `${place.cityName} • `}
                        {place.address}
                      </div>
                      {(place.districtName || place.metroName) && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {place.districtName && place.districtName}
                          {place.districtName && place.metroName && " • "}
                          {place.metroName && `м. ${place.metroName}`}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
                </div>
              )}

              {/* No Results */}
              {showEmptyState && (
                <div className="flex min-h-[112px] items-center px-4 py-6">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-900">Места не найдены</div>
                    <div className="text-sm text-muted-foreground">
                      Попробуйте другое название или создайте новое место.
                    </div>
                  </div>
                </div>
              )}

              {!isSearching && !hasSearched && (
                <div className="flex min-h-[112px] items-center px-4 py-6 text-sm text-muted-foreground">
                  Начните вводить название для поиска
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-2">
              <button
                type="button"
                onClick={handleCreateNew}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors",
                  highlightedIndex === results.length
                    ? "bg-primary/5"
                    : "hover:bg-gray-50"
                )}
              >
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Plus className="h-3 w-3 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">
                    Создать новое место
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {query.length >= 2
                      ? `Создать место "${query}"`
                      : "Добавить место вручную"}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
