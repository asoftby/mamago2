"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Building2, CheckCircle } from "lucide-react";
import type { ExistingOrganizer } from "./types";

interface OrganizerSearchSelectProps {
  selectedOrganizer: ExistingOrganizer | null;
  onSelect: (organizer: ExistingOrganizer | null) => void;
  isEditable: boolean;
}

export function OrganizerSearchSelect({ 
  selectedOrganizer, 
  onSelect, 
  isEditable 
}: OrganizerSearchSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExistingOrganizer[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/b2b/partners?query=${encodeURIComponent(searchQuery)}&limit=10`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          throw new Error(`Search failed: ${res.status}`);
        }

        const json = (await res.json()) as { ok: boolean; organizers: ExistingOrganizer[]; error?: string };
        if (!json.ok) {
          throw new Error(json.error || "Search failed");
        }

        setSearchResults(json.organizers || []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        console.error("[OrganizerSearchSelect] Search error:", e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort("Component unmounted or search query changed");
    };
  }, [searchQuery]);

  if (selectedOrganizer) {
    return (
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-green-900">{selectedOrganizer.name}</h3>
              {selectedOrganizer.isVerified && (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}
            </div>
            {selectedOrganizer.description && (
              <p className="text-sm text-green-700 mt-1">{selectedOrganizer.description}</p>
            )}
            {selectedOrganizer.phone && (
              <p className="text-sm text-green-600 mt-1">{selectedOrganizer.phone}</p>
            )}
          </div>
          {isEditable && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-sm text-green-700 hover:text-green-900 underline"
            >
              Изменить
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-medium text-primary">Поиск организатора</h3>
        <p className="text-sm text-primary/80">Найдите существующего организатора</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="organizer-search">Поиск</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="organizer-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Введите название организации..."
              className="pl-10"
              disabled={!isEditable}
            />
          </div>
        </div>

        {searchQuery && (
          <div className="space-y-2">
            {isSearching ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                Поиск...
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Результаты:</Label>
                {searchResults.map((organizer) => (
                  <button
                    key={organizer.id}
                    type="button"
                    onClick={() => onSelect(organizer)}
                    disabled={!isEditable}
                    className="w-full p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-white text-left transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{organizer.name}</span>
                          {organizer.isVerified && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        {organizer.description && (
                          <p className="text-xs text-gray-600 mt-1">{organizer.description}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                Организатор не найден
              </div>
            )}
          </div>
        )}

        {!searchQuery && (
          <div className="text-center py-6 text-gray-500">
            <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Начните вводить название для поиска</p>
          </div>
        )}
      </div>
    </div>
  );
}