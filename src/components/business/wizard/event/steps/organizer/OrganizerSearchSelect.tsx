"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Users } from "lucide-react";
import type { ExistingOrganizer } from "./types";

interface OrganizerSearchSelectProps {
  selectedOrganizer: ExistingOrganizer | null;
  onSelect: (organizer: ExistingOrganizer | null) => void;
  isEditable: boolean;
  showHeader?: boolean;
}

export function OrganizerSearchSelect({ 
  selectedOrganizer, 
  onSelect, 
  isEditable,
  showHeader = true,
}: OrganizerSearchSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExistingOrganizer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // A delayed Business selection must never override a newer manual choice.
  const selectionGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      selectionGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    let isActive = true;
    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/organizers?query=${encodeURIComponent(searchQuery)}&limit=10`,
        );

        if (!res.ok) {
          throw new Error(`Search failed: ${res.status}`);
        }

        const json = (await res.json()) as { ok: boolean; organizers: ExistingOrganizer[]; error?: string };
        if (!json.ok) {
          throw new Error(json.error || "Search failed");
        }

        if (isActive) {
          setSearchResults(json.organizers || []);
        }
      } catch (e) {
        console.error("[OrganizerSearchSelect] Search error:", e);
        if (isActive) {
          setSearchResults([]);
          setSearchError(
            e instanceof Error && e.message.includes("403")
              ? "Нет доступа к поиску организаторов. Проверьте права в бизнес-кабинете."
              : "Не удалось выполнить поиск. Попробуйте ещё раз.",
          );
        }
      } finally {
        if (isActive) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  async function handleChoose(organizer: ExistingOrganizer) {
    if (!isEditable || isResolving) return;
    if (!organizer.id.startsWith("business:")) {
      onSelect(organizer);
      return;
    }

    const businessId = organizer.id.slice("business:".length);
    const selectionGeneration = ++selectionGenerationRef.current;
    setIsResolving(true);
    setSearchError(null);
    try {
      const response = await fetch("/api/business/events/organizer-from-verified-business", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        organizer?: ExistingOrganizer;
        error?: string;
      };
      if (!response.ok || !json.ok || !json.organizer) {
        throw new Error(json.error || "Не удалось выбрать организатора");
      }
      if (mountedRef.current && selectionGenerationRef.current === selectionGeneration) {
        onSelect(json.organizer);
      }
    } catch (error) {
      if (mountedRef.current && selectionGenerationRef.current === selectionGeneration) {
        setSearchError(error instanceof Error ? error.message : "Не удалось выбрать организатора");
      }
    } finally {
      if (mountedRef.current && selectionGenerationRef.current === selectionGeneration) {
        setIsResolving(false);
      }
    }
  }

  if (selectedOrganizer) {
    return (
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-green-900">{selectedOrganizer.name}</h3>
            </div>
            {selectedOrganizer.phone && (
              <p className="text-sm text-green-600 mt-1">{selectedOrganizer.phone}</p>
            )}
            {selectedOrganizer.website && (
              <p className="text-sm text-green-700 mt-1">{selectedOrganizer.website}</p>
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
      {showHeader ? (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-primary">Поиск организатора</h3>
          <p className="text-sm text-primary/80">Найдите существующего организатора</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <Label htmlFor="organizer-search">Поиск</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="organizer-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Введите имя организатора..."
              className="pl-10"
              disabled={!isEditable}
            />
          </div>
        </div>

        {searchQuery && (
          <div className="space-y-2">
            {searchError ? (
              <div role="alert" className="text-center py-4 text-red-700 text-sm">
                {searchError}
              </div>
            ) : isSearching || isResolving ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                {isResolving ? "Выбираем организатора..." : "Поиск..."}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Результаты:</Label>
                {searchResults.map((organizer) => (
                  <button
                    key={organizer.id}
                    type="button"
                    onClick={() => void handleChoose(organizer)}
                    disabled={!isEditable || isResolving}
                    className="w-full p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-white text-left transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{organizer.name}</span>
                        </div>
                        {organizer.phone && (
                          <p className="text-xs text-gray-600 mt-1">{organizer.phone}</p>
                        )}
                        {organizer.website && (
                          <p className="text-xs text-gray-500 mt-1">{organizer.website}</p>
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
