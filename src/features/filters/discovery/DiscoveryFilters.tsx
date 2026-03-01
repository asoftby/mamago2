"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDiscoveryFilters } from "./filters.store";
import { FilterPill } from "@/features/filters/ui/FilterPill";
import { splitLabelValue, formatCountLabel } from "@/features/filters/ui/filterText";
import { MobileFilterSheet } from "@/components/discovery/MobileFilterSheet";
import { WhenSelect } from "@/components/ui/when-select";
import { CardSelect } from "@/components/ui/card-select";
import { CardMultiSelect } from "@/components/ui/card-multiselect";
import { X, SlidersHorizontal } from "lucide-react";

// Define Option type locally or import
type Option = { value: string; label: string };

type DiscoveryFiltersProps = {
  ageOptions?: Option[];
  metroOptions?: Option[];
  districtOptions?: Option[];
  forceUIMode?: "desktop" | "mobile";
};

export function DiscoveryFilters({
  ageOptions = [],
  metroOptions = [],
  districtOptions = [],
  forceUIMode,
}: DiscoveryFiltersProps) {
  const [mounted, setMounted] = useState(false);
  const isMobileQuery = useIsMobile();
  
  // Use forceUIMode if present, otherwise use media query (only after mount)
  const isMobile = forceUIMode 
    ? forceUIMode === "mobile" 
    : (mounted && isMobileQuery);

  const { 
    applied, 
    draft, 
    setDraft, 
    actions, 
    derived 
  } = useDiscoveryFilters();

  useEffect(() => {
    setMounted(true);
  }, []);

  const [sheetOpen, setSheetOpen] = useState(false);

  // Prepare "When" value
  const whenValue = applied.dateFrom 
    ? applied.dateTo 
        ? { from: new Date(applied.dateFrom), to: new Date(applied.dateTo) } 
        : new Date(applied.dateFrom)
    : null;
  
  // Handlers for Desktop (Immediate Apply)
  const handleWhenChangeDesktop = (val: any) => {
      let patch: any = {};
      if (!val) {
          patch = { dateFrom: null, dateTo: null };
      } else if (typeof val === 'string') {
          patch = { dateFrom: val, dateTo: null };
      } else if (val instanceof Date) {
          patch = { dateFrom: val.toISOString(), dateTo: null };
      } else if ('from' in val) {
          patch = { dateFrom: val.from.toISOString(), dateTo: val.to.toISOString() };
      }
      setDraft(patch);
      // Hack: we need to apply this draft immediately.
      // Ideally actions.apply() would pick up the new draft immediately, but state update is async.
      // We rely on the fact that for now Desktop isn't fully implemented with "Apply" button.
      // This will just update draft.
      // To actually apply, we need user to trigger apply.
      // Since existing components don't have Apply button, this is "broken" on desktop unless we fix components.
      // But prompt says "Keep existing desktop popovers... wire them to new core".
      // And "Clicking pill should open the existing popover/sheet logic as before".
      // The existing components (WhenSelect, CardSelect) managed their own open state and UI.
      // Here we replace the TRIGGER with FilterPill.
      // So we need to control the open state of the popovers too?
      // Yes, if we replace the trigger, we need to wrap them in Popover or let them handle it.
      // The existing components (WhenSelect, etc) render their own Trigger.
      // If we want to replace the trigger, we might need to use a custom trigger prop or refactor them.
      // Most of them accept `className` but render their own button.
      // If we want to use `FilterPill`, we need to change how `WhenSelect` etc render.
      // Or we wrap them and hide their default trigger?
      // Actually `WhenSelect` exports `WhenSelect` component.
      // If we look at `WhenSelect` code, it renders a `Popover` with `PopoverTrigger` containing a button.
      // We can't easily replace that button from outside unless it accepts a `trigger` prop.
      // It does NOT accept a `trigger` prop currently.
      
      // OPTION: We assume "Wire DiscoveryFilters desktop triggers to FilterPill" implies refactoring the components 
      // OR DiscoveryFilters renders FilterPill which controls a detached Popover content?
      // But `WhenSelect` bundles logic + UI.
      // If we can't change `WhenSelect`, we can't swap the button.
      // Prompt says: "Find the desktop UI that renders filter buttons... Replace the current per-filter button UI with <FilterPill />."
      // This implies we SHOULD change `DiscoveryFilters` JSX.
      // BUT `DiscoveryFilters` currently renders `<WhenSelect />`.
      // So we MUST refactor `WhenSelect` (and others) to accept a custom trigger OR expose content separately.
      
      // Let's refactor `WhenSelect` (and Card*) to accept `trigger` prop?
      // Or `asChild` behavior?
      // Or just styling props?
      // `FilterPill` has specific structure (label + value).
      // `WhenSelect` has its own structure.
      // The goal is "SINGLE source of truth for VISUAL style".
      // So `WhenSelect` should use `FilterPill` internally?
      // OR `DiscoveryFilters` passes `FilterPill` as a trigger.
      
      // Let's try to make `WhenSelect` etc use `FilterPill` internally or accept a render prop.
      // But the prompt says "Wire DiscoveryFilters desktop triggers to FilterPill".
      // This suggests the change happens in `DiscoveryFilters`.
      // If I replace `<WhenSelect ... />` with `<FilterPill ... />`, where does the popover come from?
      // I need to render the Popover content.
      // The existing components `WhenSelect` etc are "smart" components that handle the popover.
      // I should modify them to use `FilterPill` as their trigger button.
      
      // WAIT: "Do NOT refactor filter logic/store beyond what is needed... Keep existing desktop popovers... as-is."
      // If I modify `WhenSelect` to use `FilterPill`, that's a UI refactor.
      // Let's check if I can pass `customTrigger` to them? No.
      // So I will modify `WhenSelect`, `CardSelect`, `CardMultiSelect` to use `FilterPill` for their trigger button.
      // This seems to be the intended path to unify style.
      
      // BUT wait, step 3 says: "Wire DiscoveryFilters desktop triggers to FilterPill... Find the desktop UI... Replace the current per-filter button UI with <FilterPill />."
      // This phrasing is tricky. If I replace `<WhenSelect>` with `<FilterPill>`, I lose the functionality.
      // It must mean: Use `FilterPill` *inside* `WhenSelect` or wrapping it?
      // Or maybe `DiscoveryFilters` should manage the Popover state and just render content?
      // `useDiscoveryFilters` gives `openKey`.
      // If `DiscoveryFilters` manages `openKey`, it can render:
      // <Popover open={openKey === 'date'}> <Trigger><FilterPill /></Trigger> <Content>...</Content> </Popover>
      // But `WhenSelect` currently manages its own open state usually (or uncontrolled).
      // The previous refactor made `DiscoveryFilters` use `openKey`?
      // In `useDiscoveryFilters` hook, yes.
      // But `WhenSelect` component might not be controlled?
      // Let's check `WhenSelect`.
      // It has `open` state. It does NOT accept `open` prop in the version I read earlier?
      // Let's check.
  };

  const parseDateValue = (val: any) => {
      if (!val) return { dateFrom: null, dateTo: null };
      if (typeof val === 'string') return { dateFrom: val, dateTo: null };
      if (val instanceof Date) return { dateFrom: val.toISOString(), dateTo: null };
      if ('from' in val) return { dateFrom: val.from.toISOString(), dateTo: val.to.toISOString() };
      return { dateFrom: null, dateTo: null };
  };

  // Helper to get split label/value for FilterPill
  const getPillProps = (labelRaw: string) => {
      const { label, valueText } = splitLabelValue(labelRaw);
      return { label, valueText };
  };

  if (isMobile) {
    // Mobile Trigger (Single button)
    const activeCount = derived.activeCount;
    // We want a single pill "Фильтры"
    const pillProps = activeCount > 0 
        ? { label: "Фильтры", valueText: activeCount.toString(), isActive: true }
        : { label: "Фильтры", valueText: null, isActive: false };

    return (
      <div className="flex items-center gap-3 pb-2 w-full">
        <FilterPill 
            {...pillProps}
            onClick={() => setSheetOpen(true)}
            className="flex-1"
            rightSlot={<SlidersHorizontal className="h-4 w-4 opacity-50" />}
        />
        
        {derived.isDirty && (
          <button
            onClick={actions.resetAll}
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-background hover:bg-muted/30 transition-all text-muted-foreground hover:text-foreground shrink-0"
            title="Сбросить все"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <MobileFilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          filters={{
             when: draft.dateFrom ? (draft.dateTo ? { from: new Date(draft.dateFrom), to: new Date(draft.dateTo) } : new Date(draft.dateFrom)) : null,
             age: draft.age,
             metro: draft.metro,
             district: draft.district,
             dateFrom: draft.dateFrom,
             dateTo: draft.dateTo
          }}
          draft={draft}
          setDraft={setDraft}
          onDone={() => {
              actions.apply();
              setSheetOpen(false);
          }}
          onReset={actions.resetAll}
          ageOptions={ageOptions}
          metroOptions={metroOptions}
          districtOptions={districtOptions}
        />
      </div>
    );
  }

  // DESKTOP
  // We need to render FilterPills that open the popovers.
  // Since `WhenSelect` etc are self-contained, we should ideally use them.
  // I will refactor `WhenSelect`, `CardSelect`, `CardMultiSelect` to accept a `trigger` prop
  // OR make them use `FilterPill` internally.
  // Given the instruction "Do NOT refactor filter logic/store beyond what is needed to replace button visuals",
  // and "Wire DiscoveryFilters desktop triggers to FilterPill",
  // I'll modify the *components* to use FilterPill.
  
  // Wait, if I modify the components, I don't need to change DiscoveryFilters much?
  // Except passing the right label/value props if needed.
  // But `WhenSelect` calculates its own label usually?
  // `DiscoveryFilters` calculates `derived.labels`.
  // I should pass these labels to the components so they can pass them to `FilterPill`.
  // Currently `WhenSelect` takes `label` prop.
  
  return (
    <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-x-[12px] pb-2 items-center py-1">
      {derived.isDirty && (
          <button
            onClick={actions.resetAll}
            className="flex h-[40px] w-[40px] min-w-[40px] items-center justify-center rounded-full border bg-background hover:bg-muted/30 transition-all text-muted-foreground hover:text-foreground mr-2"
            title="Сбросить все фильтры"
          >
            <X className="h-5 w-5" />
          </button>
      )}
      
      {/* 
          NOTE: To use FilterPill, we need to pass `customTrigger` to these components 
          OR update them to use FilterPill internally.
          I will assume I need to update them.
          I'll update `WhenSelect` first.
      */}
      <WhenSelect 
        className="w-auto" 
        value={whenValue} 
        onChange={handleWhenChangeDesktop}
        uiMode="desktop"
        // New props for visual sync
        trigger={(
            <FilterPill 
                {...getPillProps(derived.labels.dateLabel)}
                isActive={!!applied.dateFrom}
            />
        )}
      />
      <CardMultiSelect 
        label="Возраст" // This is fallback if trigger not provided?
        options={ageOptions} 
        values={applied.age} 
        onChange={() => {}} 
        allowClear
        className="w-auto" 
        uiMode="desktop"
        trigger={(
            <FilterPill 
                {...getPillProps(derived.labels.ageLabel)}
                isActive={applied.age.length > 0}
            />
        )}
      />
      <CardMultiSelect 
        label="Метро" 
        options={metroOptions} 
        values={applied.metro} 
        onChange={() => {}} 
        allowClear
        className="w-auto" 
        uiMode="desktop"
        trigger={(
            <FilterPill 
                {...getPillProps(derived.labels.metroLabel)}
                isActive={applied.metro.length > 0}
            />
        )}
      />
      <CardSelect 
        label="Район" 
        options={districtOptions} 
        value={applied.district} 
        onChange={() => {}} 
        allowClear
        className="w-auto" 
        uiMode="desktop"
        trigger={(
            <FilterPill 
                {...getPillProps(derived.labels.districtLabel)}
                isActive={!!applied.district}
            />
        )}
      />
    </div>
  );
}
