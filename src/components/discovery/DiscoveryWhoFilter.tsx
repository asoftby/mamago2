"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AgePanel } from "@/components/site/header/search-segments/AgePanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MobileOverlayResetAction } from "@/components/mobile/MobileOverlayResetAction";
import { MobileOverlayPrimaryAction } from "@/components/mobile/MobileOverlayPrimaryAction";
import { useIsMobile } from "@/hooks/use-mobile";
import { Chip } from "@/components/ui/Chip";
import { useFamilyPersona } from "@/contexts/FamilyPersonaContext";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { MAX_ACTIVE_FAMILY_PERSONAS } from "@/lib/family/wholeFamilyPreset";
import { mapPlanParticipantsToAudience } from "@/lib/family/audienceSyncMapper";
import { resolveFamilyAgeMode } from "@/lib/family/familyAgeMode";
import { useEventAvailableFacets } from "@/features/filters/discovery/useEventAvailableFacets";
import { ClearableQuickFilterChip } from "./ClearableQuickFilterChip";

/** Shared who/age controls for the Kuda row and dialog; never a second age state. */
export function DiscoveryWhoFilter({ inline = false }: { inline?: boolean }) {
  const { applied, actions } = useDiscoveryFilters();
  const family = useFamilyPersona();
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const facets = useEventAvailableFacets(applied, inline || open);
  const selected = family?.selectedPersonaIds ?? [];
  const children = !family?.loading ? family?.childPersonasForFilter ?? [] : [];
  const childIds = children.map(child => child.id);
  const ageMode = resolveFamilyAgeMode({
    hasProfileChildren: children.length > 0,
    selectedPersonaIds: selected,
    profileChildIds: childIds,
  });
  const appliedProfileIds = applied.profile?.split(",").filter(Boolean) ?? [];
  const activeProfile = appliedProfileIds.length === 1
    ? family?.personas.find(p => p.id === appliedProfileIds[0])
    : null;
  const hasWhoFilter = Boolean(applied.age.length || applied.profile || applied.adultOnly);
  const agesLabel = applied.age.length === 1
    ? AGE_GROUPS.find(group => group.value === applied.age[0])?.label
    : applied.age.length > 1 ? `${applied.age.length} возраста` : null;
  const label = activeProfile?.kind === "adult" ? "Я"
    : activeProfile?.displayName ?? (appliedProfileIds.length > 1 ? `Семья · ${appliedProfileIds.length}` : agesLabel ?? "Для кого");

  const setSelection = (nextIds: string[]) => {
    if (!family) return;
    family.setSelectedPersonaIds(nextIds);
    actions.setDraft({
      profile: null,
      age: mapPlanParticipantsToAudience(nextIds, family.personas),
      adultOnly: false,
    });
  };

  const clearWho = (close = true) => {
    family?.setSelectedPersonaIds([]);
    actions.setDraft({ age: [], profile: null, adultOnly: false });
    if (close) setOpen(false);
  };

  const panel = (
    <AgePanel
      onClose={() => setOpen(false)}
      embedded
      applied={applied}
      actions={{ setDraft: patch => {
        if (!Array.isArray(patch.age)) { actions.setDraft(patch); return; }
        if (selected.length) family?.setSelectedPersonaIds([]);
        actions.setDraft({ age: patch.age, profile: null, adultOnly: patch.age.includes("18+") });
      } }}
      selectedPersonaIds={selected.filter(id => mapPlanParticipantsToAudience([id], family?.personas ?? []).some(age => applied.age.includes(age)))}
      selectedChildIds={selected.filter(id => childIds.includes(id))}
      availableChildren={children}
      onToggleChild={family ? id => setSelection(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]) : undefined}
      primaryAdult={family?.primaryAdultPersonaId ? {
        id: family.primaryAdultPersonaId,
        displayName: "Я",
      } : null}
      adultSelected={!!family?.primaryAdultPersonaId && selected.includes(family.primaryAdultPersonaId)}
      onToggleAdult={family?.primaryAdultPersonaId ? () => {
        const id = family.primaryAdultPersonaId!;
        setSelection(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
      } : undefined}
      ageMode="manual"
      autoAgeValues={selected.length ? applied.age : []}
      availableAgeValues={selected.length ? facets?.ages ?? null : null}
      personaPickAtLimit={selected.length >= MAX_ACTIVE_FAMILY_PERSONAS}
      whoFreeMode={selected.length === 0}
      onSelectEveryone={family ? () => setSelection([]) : undefined}
    />
  );

  if (inline) {
    return <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">Для кого / Возраст детей</legend>
      {panel}
    </fieldset>;
  }

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Chip active={hasWhoFilter} className="h-11 shrink-0 gap-2 px-5">
            {label} <ChevronDown className="h-4 w-4" />
          </Chip>
        </SheetTrigger>
        <SheetContent side="bottom" className="flex h-[92dvh] flex-col gap-0 rounded-t-3xl bg-white p-0">
          <div className="shrink-0 border-b bg-white px-5 py-4">
            <SheetTitle>Для кого</SheetTitle>
            <p className="mt-1 text-sm text-muted-foreground">Выберите участников или возраст детей</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {panel}
          </div>
          <div className="shrink-0 border-t bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-3">
              <MobileOverlayResetAction disabled={!hasWhoFilter} onClick={() => clearWho(false)} />
              <div className="min-w-0 flex-1" />
              <MobileOverlayPrimaryAction onClick={() => setOpen(false)}>
                Показать
              </MobileOverlayPrimaryAction>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ClearableQuickFilterChip active={hasWhoFilter} clearLabel="Сбросить возраст и профиль" onClear={clearWho}>
        <PopoverTrigger asChild>
          <Chip
            active={hasWhoFilter}
            className={`h-11 shrink-0 gap-2 px-5 ${hasWhoFilter ? "rounded-r-none pr-3" : ""}`}
          >
            {label} <ChevronDown className="h-4 w-4" />
          </Chip>
        </PopoverTrigger>
      </ClearableQuickFilterChip>
      <PopoverContent align="start" className="w-[min(95vw,440px)] p-0">
        {panel}
      </PopoverContent>
    </Popover>
  );
}
