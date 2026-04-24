"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { Search, Sparkles, Plus, Phone, Globe, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventFormData } from "../types";
import { OrganizerSearchSelect } from "./organizer/OrganizerSearchSelect";
import { OrganizerCreateForm } from "./organizer/OrganizerCreateForm";
import type { ExistingOrganizer } from "./organizer/types";

interface Step8OrganizerProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
  eventId?: string | null;
}

type OrganizerImportHint = {
  name: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
};

type UnpLookupState = {
  legalName: string | null;
  source: "EGR" | "GRP" | null;
};

type OrganizerMode = EventFormData["organizerMode"];

export function Step8Organizer({
  data,
  onChange,
  isEditable,
  eventId,
}: Step8OrganizerProps) {
  const [importHint, setImportHint] = useState<OrganizerImportHint | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [unpLookupState, setUnpLookupState] = useState<UnpLookupState | null>(null);

  useEffect(() => {
    if (!eventId) return;

    let isActive = true;
    const controller = new AbortController();

    async function loadHint() {
      setIsLoadingHint(true);
      try {
        const response = await fetch(`/api/business/events/${eventId}/organizer-source`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load organizer hint: ${response.status}`);
        }
        const json = (await response.json()) as { organizer?: OrganizerImportHint | null };
        if (isActive) {
          setImportHint(json.organizer ?? null);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("[Step8Organizer] Failed to load organizer hint:", error);
      } finally {
        if (isActive) {
          setIsLoadingHint(false);
        }
      }
    }

    void loadHint();
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [eventId]);

  const selectedExistingOrganizer = useMemo<ExistingOrganizer | null>(() => {
    if (data.organizerMode !== "existing" || !data.organizerId || !data.organizerName.trim()) {
      return null;
    }

    return {
      id: data.organizerId,
      name: data.organizerName,
      unp: data.organizerUnp || undefined,
      phone: data.organizerPhone || undefined,
      website: data.organizerWebsite || undefined,
      instagram: data.organizerInstagram || undefined,
    };
  }, [
    data.organizerId,
    data.organizerInstagram,
    data.organizerMode,
    data.organizerName,
    data.organizerUnp,
    data.organizerPhone,
    data.organizerWebsite,
  ]);

  const modeCards: Array<{
    id: OrganizerMode;
    title: string;
    subtitle: string;
    icon: typeof Search;
  }> = [
    {
      id: "existing",
      title: "Найти организатора",
      subtitle: "Использовать уже созданного организатора",
      icon: Search,
    },
    ...(importHint?.name || data.organizerMode === "import"
      ? [
          {
            id: "import" as const,
            title: "Использовать из источника",
            subtitle: "Взять организатора из данных импорта",
            icon: Sparkles,
          },
        ]
      : []),
    {
      id: "manual",
      title: "Создать нового организатора",
      subtitle: "Указать данные вручную без создания Business",
      icon: Plus,
    },
  ];

  const handleModeChange = (mode: OrganizerMode) => {
    if (mode === "import" && importHint?.name) {
      onChange({
        organizerMode: "import",
        organizerId: null,
        organizerName: importHint.name,
        organizerUnp: "",
        organizerPhone: importHint.phone ?? "",
        organizerWebsite: importHint.website ?? "",
        organizerInstagram: importHint.instagram ?? "",
      });
      return;
    }

    onChange({
      organizerMode: mode,
      ...(mode !== "existing" ? { organizerId: null } : {}),
    });
  };

  const handleExistingOrganizerSelect = (organizer: ExistingOrganizer | null) => {
    if (!organizer) {
      onChange({
        organizerId: null,
        organizerName: "",
        organizerUnp: "",
        organizerPhone: "",
        organizerWebsite: "",
        organizerInstagram: "",
      });
      return;
    }

    onChange({
      organizerMode: "existing",
      organizerId: organizer.id,
      organizerName: organizer.name,
      organizerUnp: organizer.unp ?? "",
      organizerPhone: organizer.phone ?? "",
      organizerWebsite: organizer.website ?? "",
      organizerInstagram: organizer.instagram ?? "",
    });
  };

  const handleManualOrganizerChange = (
    updates: Partial<{
      name: string;
      unp: string;
      phone: string;
      website: string;
      instagram: string;
    }>,
  ) => {
    onChange({
      organizerMode: "manual",
      organizerId: null,
      organizerName: updates.name ?? data.organizerName,
      organizerUnp: updates.unp ?? data.organizerUnp,
      organizerPhone: updates.phone ?? data.organizerPhone,
      organizerWebsite: updates.website ?? data.organizerWebsite,
      organizerInstagram: updates.instagram ?? data.organizerInstagram,
    });
  };

  const handleApplyImportOrganizer = () => {
    if (!importHint?.name) {
      toast.error("В источнике нет данных об организаторе");
      return;
    }

    onChange({
      organizerMode: "import",
      organizerId: null,
      organizerName: importHint.name,
      organizerUnp: "",
      organizerPhone: importHint.phone ?? "",
      organizerWebsite: importHint.website ?? "",
      organizerInstagram: importHint.instagram ?? "",
    });
    toast.success("Организатор из источника подставлен в форму");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Организатор</h2>
        <p className="text-[12px] text-muted-foreground">
          Организатор события хранится отдельно от бизнеса. Можно выбрать существующего,
          взять из импорта или создать нового вручную.
        </p>
      </div>

      <div className="space-y-3">
        {modeCards.map((option) => {
          const Icon = option.icon;
          const selected = data.organizerMode === option.id;

          return (
            <div
              key={option.id}
              className={`overflow-hidden rounded-xl border transition-colors ${
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/30"
              } ${!isEditable ? "opacity-60" : ""}`}
            >
              <button
                type="button"
                disabled={!isEditable}
                onClick={() => handleModeChange(option.id)}
                className={`w-full p-4 text-left ${!isEditable ? "cursor-not-allowed" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg ${
                      selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">{option.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{option.subtitle}</div>
                  </div>
                </div>
              </button>

              {selected ? (
                <div className="border-t border-current/10 px-4 pb-4 pt-4">
                  {option.id === "existing" ? (
                    <OrganizerSearchSelect
                      selectedOrganizer={selectedExistingOrganizer}
                      onSelect={handleExistingOrganizerSelect}
                      isEditable={isEditable}
                      showHeader={false}
                    />
                  ) : null}

                  {option.id === "import" ? (
                    importHint?.name || data.organizerName.trim() ? (
                      <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-sky-700" />
                          <h3 className="font-medium text-sky-950">Организатор из источника</h3>
                        </div>
                        <div className="space-y-2 text-sm text-sky-950">
                          <div className="font-medium">{importHint?.name ?? data.organizerName}</div>
                          {(importHint?.phone ?? data.organizerPhone) ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-sky-700" />
                              <span>{importHint?.phone ?? data.organizerPhone}</span>
                            </div>
                          ) : null}
                          {(importHint?.website ?? data.organizerWebsite) ? (
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-sky-700" />
                              <span>{importHint?.website ?? data.organizerWebsite}</span>
                            </div>
                          ) : null}
                          {(importHint?.instagram ?? data.organizerInstagram) ? (
                            <div className="flex items-center gap-2">
                              <Instagram className="h-4 w-4 text-sky-700" />
                              <span>{importHint?.instagram ?? data.organizerInstagram}</span>
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-4">
                          <Button
                            type="button"
                            onClick={handleApplyImportOrganizer}
                            disabled={!isEditable || !importHint?.name}
                          >
                            Использовать организатора
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                        {isLoadingHint
                          ? "Проверяем данные импорта..."
                          : "В источнике не найдено данных об организаторе."}
                      </div>
                    )
                  ) : null}

                  {option.id === "manual" ? (
                    <div className="space-y-4">
                      <OrganizerCreateForm
                        data={{
                          name: data.organizerName,
                          unp: data.organizerUnp,
                          phone: data.organizerPhone,
                          website: data.organizerWebsite,
                          instagram: data.organizerInstagram,
                        }}
                        onChange={handleManualOrganizerChange}
                        isEditable={isEditable}
                        showHeader={false}
                        onUnpResolved={(result) => {
                          if (result.legalName) {
                            setUnpLookupState({
                              legalName: result.legalName,
                              source: (result.source as "EGR" | "GRP" | null) ?? null,
                            });
                            if (!data.organizerName.trim() || data.organizerName.trim() === data.organizerUnp) {
                              onChange({ organizerName: result.legalName });
                            }
                          } else {
                            setUnpLookupState(null);
                          }
                        }}
                        onUnpReset={() => {
                          setUnpLookupState(null);
                        }}
                      />

                      {unpLookupState?.legalName ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                          <div className="font-medium text-emerald-950">Найдено юридическое лицо</div>
                          <div className="mt-2 text-sm text-emerald-900">{unpLookupState.legalName}</div>
                          <div className="mt-2 text-xs text-emerald-800">
                            Источник: {unpLookupState.source ?? "lookup"}
                          </div>
                          <div className="mt-3 text-sm text-emerald-900">
                            При сохранении Organizer будет связан с существующим бизнесом по УНП
                            или создаст новый неподтверждённый бизнес-профиль (DRAFT), если такого профиля ещё нет.
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
