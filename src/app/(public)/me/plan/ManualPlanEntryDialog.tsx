"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ManualPlanEntryForm,
  type ManualPlanEntryChildOption,
} from "@/features/my-plan/components/ManualPlanEntryForm";
import type { SerializedPlanItem } from "./PlanPageClient";

export function ManualPlanEntryDialog({
  open,
  onOpenChange,
  date,
  familyChildren,
  item,
  onSaved,
  onConflict,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  familyChildren: ManualPlanEntryChildOption[];
  item: SerializedPlanItem | null;
  onSaved: (item: SerializedPlanItem) => void;
  onConflict: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto rounded-2xl p-0 sm:w-full">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle>{item ? "Изменить запись" : "Добавить своё"}</DialogTitle>
          <DialogDescription>Событие, занятие, дело или заметка в семейном плане</DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-5 pt-4">
          <ManualPlanEntryForm<SerializedPlanItem>
            active={open}
            date={date}
            familyChildren={familyChildren}
            item={item}
            onConflict={onConflict}
            onSaved={(saved) => {
              onSaved(saved);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
