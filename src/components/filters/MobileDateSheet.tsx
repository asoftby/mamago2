"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WhenSelect } from "@/components/ui/when-select";

type MobileDateSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: any;
  onChange: (val: any) => void;
};

// Reuse helpers from WhenSelect or duplicate them to avoid export issues if they aren't exported.
// Since WhenSelect exports are limited, we'll duplicate the logic for the sheet content
// OR better yet, we can reuse WhenSelect with variant="embedded" which already renders the content we need!
// The user prompt says: "MobileDateSheet... Used for: Когда идём... Structure: Bottom sheet... Top horizontal tabs... Calendar below..."
// And WhenSelect variant="embedded" does EXACTLY this structure (tabs + calendar).

export function MobileDateSheet({
  open,
  onOpenChange,
  value,
  onChange,
}: MobileDateSheetProps) {
  // Local draft state
  const [draftValue, setDraftValue] = React.useState(value);

  // Sync draft with prop value when opening
  React.useEffect(() => {
    if (open) {
        setDraftValue(value);
    }
  }, [open, value]);
  
  const handleDone = () => {
    onChange(draftValue);
    onOpenChange(false);
  };

  const handleReset = () => {
    setDraftValue(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="fixed inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-3xl bg-background border-t border-border/60 shadow-2xl p-0 flex flex-col overflow-hidden gap-0"
      >
        {/* Header */}
        <div className="flex items-center justify-center p-4 border-b border-border/40 relative shrink-0">
          <SheetTitle>Когда идём</SheetTitle>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
            <WhenSelect
              variant="embedded"
              value={draftValue}
              onChange={setDraftValue}
              className="border-none p-0"
            />
        </div>

        {/* Sticky Footer Action Bar */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/60 px-4 py-3 pb-[calc(16px+env(safe-area-inset-bottom))] flex items-center justify-between shrink-0">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Сбросить
          </button>
          <Button
            onClick={handleDone}
            variant="default"
            className="rounded-full shadow-lg active:scale-95 transition-all px-8 font-semibold"
          >
            Готово
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
