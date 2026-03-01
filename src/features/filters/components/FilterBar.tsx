/**
 * Generic filter system (non-discovery).
 * For discovery use src/features/filters/discovery/DiscoveryFilters.tsx
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { FilterDef } from "../types";
import { useFilterState } from "../useFilterState";
import { FilterControl } from "./FilterControl";

interface FilterBarProps {
  defs: FilterDef[];
  className?: string;
  variant?: "sticky" | "inline";
}

export function FilterBar({
  defs,
  className,
  variant = "inline",
}: FilterBarProps) {
  const {
    applied,
    draft,
    openKey,
    setOpenKey,
    beginDraft,
    setDraft,
    apply,
    reset,
    resetKey,
    close,
  } = useFilterState(defs);

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 overflow-x-auto p-2 no-scrollbar",
        variant === "sticky" && "sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      {defs.map((def) => {
        const isOpen = openKey === def.key;
        
        // When opening, initialize draft
        const handleOpenChange = (open: boolean) => {
          if (open) {
            beginDraft(def.key);
            setOpenKey(def.key);
          } else {
            close();
          }
        };

        const handleReset = () => {
          // Reset just this key
          // We can set draft to empty and apply?
          // Or modify hook to support resetKey(key).
          // Let's implement resetKey logic here for now:
          setDraft(def.key, def.mode === 'multi' ? [] : null);
          // And ideally apply immediately? Or just clear draft?
          // Requirement: "Reset clears both draft and URL for those filter keys."
          // So we should update URL too.
          // But useFilterState `reset` clears ALL.
          // We need `resetKey` in hook ideally.
          // For now, let's clear draft and call apply immediately?
          // Or modify hook. Let's modify hook later if needed, 
          // but here we can just set draft to null/empty and call apply().
          // Wait, apply() applies ALL drafts. If other drafts are pending (e.g. user opened another filter but didn't apply?),
          // `draft` object in hook holds all current drafts.
          // But `beginDraft` only initializes ONE key.
          // So `draft` likely only contains the currently open key's draft + potentially stale drafts from previous opens if they weren't cleared.
          // `close()` leaves draft as is.
          // `beginDraft` overwrites draft[key] from applied.
          // So `draft` is safe to apply if we only care about current open key.
          
          // Let's just set draft to empty and apply.
          // But we need to make sure we don't accidentally apply other pending drafts if any.
          // Since `openKey` ensures we only focus on one filter at a time, usually only one draft is active.
          
          // Actually, let's just clear draft and close.
          // Wait, user expects Reset to clear URL too.
          // So:
          // 1. Update draft to empty
          // 2. Apply (writes draft to URL)
          // 3. Close
          
          // However, `setDraft` is async (state update).
          // We can't call apply() immediately after setDraft in same render cycle without effect.
          // Maybe we need a specific `resetKey` in hook.
          // Let's stick to what we have:
          // We will pass a handler that does: setDraft(empty) -> then user clicks Apply?
          // No, Reset button usually acts immediately.
          // Let's add `resetKey` to hook in next step if possible, or just hack it here.
          // We can manually call router.replace with deleted param.
          // But that bypasses hook state.
          
          // Let's assume we implement `resetKey` in hook.
          // I will update useFilterState.ts to include `resetKey`.
        };

        return (
          <FilterControl
            key={def.key}
            def={def}
            appliedValue={applied[def.key]}
            draftValue={draft[def.key] ?? applied[def.key]}
            isOpen={isOpen}
            onOpenChange={handleOpenChange}
            onDraftChange={(val) => setDraft(def.key, val)}
            onApply={() => apply()} // Applies current draft to URL
            onReset={() => resetKey(def.key)}
          />
        );
      })}
    </div>
  );
}
