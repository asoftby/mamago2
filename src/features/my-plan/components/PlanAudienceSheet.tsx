"use client";

import { useState, useMemo } from "react";
import { Users, Plus, Check } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QuickAddChildModal } from "@/components/children/QuickAddChildModal";
import { AddParticipantModal } from "@/components/children/AddParticipantModal";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";

interface PlanAudienceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Все персоны */
  personas: FamilyPersona[];
  /** Выбранные ID персон */
  selectedPersonaIds: string[];
  /** Обработчик изменения выбора */
  onSelectionChange: (ids: string[]) => void;
  /** Layout */
  layout?: "default" | "desktop";
}

/** Calculate age from birth date */
function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  
  return age >= 0 ? age : null;
}

/** Format age with proper Russian plural form */
function formatAge(age: number): string {
  const lastDigit = age % 10;
  const lastTwoDigits = age % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${age} лет`;
  }
  
  if (lastDigit === 1) {
    return `${age} год`;
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${age} года`;
  }
  
  return `${age} лет`;
}

export function PlanAudienceSheet({
  open,
  onOpenChange,
  personas,
  selectedPersonaIds,
  onSelectionChange,
  layout = "default",
}: PlanAudienceSheetProps) {
  const isDesktop = layout === "desktop";
  const [showAddChild, setShowAddChild] = useState(false);
  const [showAddAdult, setShowAddAdult] = useState(false);

  // Derive free search mode from selection
  const isFreeSearchMode = selectedPersonaIds.length === 0;

  const children = useMemo(
    () => personas.filter((p) => p.kind === "child"),
    [personas]
  );

  const adults = useMemo(
    () => personas.filter((p) => p.kind === "adult"),
    [personas]
  );

  const handleTogglePersona = (personaId: string) => {
    if (isFreeSearchMode) {
      // Переключаемся из режима "Свободный поиск" в конкретную персону
      onSelectionChange([personaId]);
      return;
    }

    if (selectedPersonaIds.includes(personaId)) {
      const next = selectedPersonaIds.filter((id) => id !== personaId);
      // Если снимаем последнюю персону, переключаемся в режим "Свободный поиск"
      onSelectionChange(next);
    } else {
      onSelectionChange([...selectedPersonaIds, personaId]);
    }
  };

  const handleFreeSearchClick = () => {
    // Активируем режим "Свободный поиск" - просто очищаем выбор
    onSelectionChange([]);
  };

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-neutral-200 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-neutral-900">
              Для кого планируем?
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Выберите участников или режим &quot;Для всех&quot;
            </p>
          </div>
          <ModalCloseButton
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0"
          />
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-6">
          {/* Режим "Для всех" */}
          <div>
            <button
              type="button"
              onClick={handleFreeSearchClick}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 transition-all",
                isFreeSearchMode
                  ? "border-[#EF8759] bg-[#EF8759]/5"
                  : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  isFreeSearchMode ? "bg-[#EF8759]/10" : "bg-neutral-100"
                )}
              >
                <Users
                  className={cn(
                    "h-5 w-5",
                    isFreeSearchMode ? "text-[#EF8759]" : "text-neutral-600"
                  )}
                />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="font-medium text-neutral-900">Свободный поиск</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  Без учёта профилей и интересов
                </p>
              </div>
              {isFreeSearchMode ? (
                <Check className="h-5 w-5 shrink-0 text-[#EF8759]" />
              ) : null}
            </button>
          </div>

          {/* Дети */}
          {children.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">Дети</h3>
              <div className="space-y-2">
                {children.map((child) => {
                  const isSelected =
                    !isFreeSearchMode && selectedPersonaIds.includes(child.id);
                  const age = calculateAge(child.birthDate);
                  const interests = child.preferenceSummary?.trim();
                  
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => handleTogglePersona(child.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-3 transition-all",
                        isSelected
                          ? "border-[#EF8759] bg-[#EF8759]/5"
                          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                      )}
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <p className="font-medium text-neutral-900">
                          {child.displayName}
                          {age !== null ? (
                            <span className="text-neutral-500"> ({formatAge(age)})</span>
                          ) : null}
                        </p>
                        {interests ? (
                          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                            {interests}
                          </p>
                        ) : null}
                      </div>
                      {isSelected ? (
                        <Check className="h-5 w-5 shrink-0 text-[#EF8759]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Взрослые */}
          {adults.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">Взрослые</h3>
              <div className="space-y-2">
                {adults.map((adult) => {
                  const isSelected =
                    !isFreeSearchMode && selectedPersonaIds.includes(adult.id);
                  const role = adult.familyRole?.trim();
                  const preferences = adult.leisureFormatSummary?.trim() || adult.preferenceSummary?.trim();
                  
                  return (
                    <button
                      key={adult.id}
                      type="button"
                      onClick={() => handleTogglePersona(adult.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-3 transition-all",
                        isSelected
                          ? "border-[#EF8759] bg-[#EF8759]/5"
                          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                      )}
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <p className="font-medium text-neutral-900">
                          {adult.displayName}
                          {role ? (
                            <span className="text-neutral-500"> ({role})</span>
                          ) : null}
                        </p>
                        {preferences ? (
                          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                            {preferences}
                          </p>
                        ) : null}
                      </div>
                      {isSelected ? (
                        <Check className="h-5 w-5 shrink-0 text-[#EF8759]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Добавить участников */}
          <div className="space-y-2">
            <button
              key="add-child-button"
              type="button"
              onClick={() => setShowAddChild(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-transparent px-4 py-3 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-50/50 hover:text-neutral-700"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Добавить ребёнка
            </button>
            <button
              key="add-adult-button"
              type="button"
              onClick={() => setShowAddAdult(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-transparent px-4 py-3 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-50/50 hover:text-neutral-700"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Добавить взрослого
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-neutral-200 bg-white px-5 py-4">
        <Button
          onClick={() => onOpenChange(false)}
          className="h-11 w-full bg-neutral-900 font-semibold hover:bg-neutral-800"
        >
          Готово
        </Button>
      </div>

      {/* Modals */}
      <QuickAddChildModal
        open={showAddChild}
        onOpenChange={setShowAddChild}
        onSuccess={(childId) => {
          // Автоматически выбираем нового ребёнка
          if (!isFreeSearchMode) {
            onSelectionChange([...selectedPersonaIds, childId]);
          } else {
            // Переключаемся из "Для всех" в конкретного ребёнка
            onSelectionChange([childId]);
          }
        }}
      />

      <AddParticipantModal
        isOpen={showAddAdult}
        onClose={() => setShowAddAdult(false)}
        editAdult={false}
        onSaved={(payload) => {
          if (payload.kind === "adult") {
            // Взрослый обновлён, обновляем список
            // Автоматический выбор не делаем для взрослого
          }
        }}
      />
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[min(90vh,720px)] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full"
          )}
          aria-describedby={undefined}
          showCloseButton={false}
        >
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[85vh] max-h-[85vh] flex-col gap-0 p-0"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        {content}
      </SheetContent>
    </Sheet>
  );
}
