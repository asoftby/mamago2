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
import { Separator } from "@/components/ui/separator";
import { WhenSelect } from "@/components/ui/when-select";

export type SaveScenario =
  | { kind: "confirm"; title: string; dateLabel: string; timeLabel: string; dateISO: string; slotId?: string | null }
  | { kind: "timeslots"; title: string; dateLabel: string; dateISO: string; slots: { id: string; label: string }[] }
  | { kind: "quickdate"; title: string };

export type SaveToPlanResult =
  | { action: "plan"; dateISO: string; timeSlotId?: string | null }
  | { action: "ideas" }
  | { action: "cancel" };

interface SaveToPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: SaveScenario;
  onConfirm: (result: SaveToPlanResult) => void;
}

export function SaveToPlanModal({
  open,
  onOpenChange,
  scenario,
  onConfirm,
}: SaveToPlanModalProps) {
  const [selectedSlotId, setSelectedSlotId] = React.useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);

  // Initialize selected slot when timeslots scenario opens
  React.useEffect(() => {
    if (open && scenario.kind === "timeslots" && scenario.slots.length > 0) {
      setSelectedSlotId(scenario.slots[0].id);
    }
  }, [open, scenario]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setSelectedSlotId(null);
      setShowDatePicker(false);
      setSelectedDate(null);
    }
  }, [open]);

  const handleAddToPlan = () => {
    if (scenario.kind === "confirm") {
      onConfirm({
        action: "plan",
        dateISO: scenario.dateISO,
        timeSlotId: scenario.slotId ?? null,
      });
    } else if (scenario.kind === "timeslots") {
      onConfirm({
        action: "plan",
        dateISO: scenario.dateISO,
        timeSlotId: selectedSlotId,
      });
    }
    onOpenChange(false);
  };

  const handleAddToIdeas = () => {
    onConfirm({ action: "ideas" });
    onOpenChange(false);
  };

  const handleQuickDate = (dateISO: string) => {
    onConfirm({ action: "plan", dateISO, timeSlotId: null });
    onOpenChange(false);
  };

  const handleToday = () => {
    const today = new Date();
    const dateISO = today.toISOString().split("T")[0];
    handleQuickDate(dateISO);
  };

  const handleTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateISO = tomorrow.toISOString().split("T")[0];
    handleQuickDate(dateISO);
  };

  const handleDateSelected = (value: any) => {
    if (value instanceof Date) {
      const dateISO = value.toISOString().split("T")[0];
      handleQuickDate(dateISO);
    }
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
          <SheetTitle>
            {scenario.kind === "confirm" && "Добавить в план?"}
            {scenario.kind === "timeslots" && "Выберите время"}
            {scenario.kind === "quickdate" && "Когда планируем?"}
          </SheetTitle>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-24">
          {/* Case A: Confirm */}
          {scenario.kind === "confirm" && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-base font-medium">{scenario.title}</p>
                <p className="text-sm text-muted-foreground">
                  {scenario.dateLabel} • {scenario.timeLabel}
                </p>
              </div>
            </div>
          )}

          {/* Case B: Timeslots */}
          {scenario.kind === "timeslots" && (
            <div className="space-y-4">
              <div className="text-center space-y-1 mb-6">
                <p className="text-base font-medium">{scenario.title}</p>
                <p className="text-sm text-muted-foreground">{scenario.dateLabel}</p>
              </div>

              {/* Radio Group (manual implementation since no RadioGroup component exists) */}
              <div className="space-y-2">
                {scenario.slots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all",
                      selectedSlotId === slot.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-border/80"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        selectedSlotId === slot.id
                          ? "border-primary"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {selectedSlotId === slot.id && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="text-base font-medium">{slot.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Case C: Quickdate */}
          {scenario.kind === "quickdate" && (
            <div className="space-y-4">
              <div className="text-center space-y-1 mb-6">
                <p className="text-base font-medium">{scenario.title}</p>
                <p className="text-sm text-muted-foreground">
                  Выберите день — добавим в план
                </p>
              </div>

              {!showDatePicker ? (
                <div className="space-y-3">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full rounded-xl"
                    onClick={handleToday}
                  >
                    Сегодня
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full rounded-xl"
                    onClick={handleTomorrow}
                  >
                    Завтра
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full rounded-xl"
                    onClick={() => setShowDatePicker(true)}
                  >
                    Выбрать дату
                  </Button>

                  <Separator className="my-4" />

                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full rounded-xl"
                    onClick={handleAddToIdeas}
                  >
                    В идеи
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <WhenSelect
                    variant="embedded"
                    value={selectedDate}
                    onChange={handleDateSelected}
                    className="border-none p-0"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Footer Action Bar (for confirm and timeslots cases) */}
        {(scenario.kind === "confirm" || scenario.kind === "timeslots") && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/60 px-4 py-3 pb-[calc(16px+env(safe-area-inset-bottom))] flex items-center gap-3 shrink-0">
            <Button
              onClick={handleAddToIdeas}
              variant="secondary"
              size="lg"
              className="flex-1 rounded-full font-semibold"
            >
              В идеи
            </Button>
            <Button
              onClick={handleAddToPlan}
              variant="default"
              size="lg"
              className="flex-1 rounded-full shadow-lg active:scale-95 transition-all font-semibold"
            >
              Добавить
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
