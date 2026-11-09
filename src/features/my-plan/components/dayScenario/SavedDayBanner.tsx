"use client";

import { useState } from "react";
import { MoreHorizontal, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";
import { invalidatePlanDayMarkers } from "@/features/plan-calendar/usePlanDayCounts";
import { requestPlanRefetchForDate } from "@/lib/my-plan/myPlanOpenIntent";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PLAN_FOCUS } from "../v3/planChipStyles";
import { pairLinkLabel, savedDayTitle, type PairDay } from "../../lib/dayScenarioUi/model";

const MENU_ITEM = `mp-font-ui flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[15px] font-medium text-[var(--mp-tx)] transition-colors hover:bg-[var(--mp-bg)] ${PLAN_FOCUS}`;

/**
 * «День от mamaGo · N мест» above the day of a saved scenario: a link to the other day of the weekend and a ⋯ menu
 * (delete this day, delete the weekend). Only what the scenario created is removed; the user's own entries stay.
 */
export function SavedDayBanner({
  date,
  count,
  pair,
  onOpenDate,
  onEdit,
}: {
  date: string;
  count: number;
  pair: PairDay | null;
  onOpenDate: (date: string) => void;
  /** «Изменить день»: opens the draft with the saved points. */
  onEdit?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmWeekend, setConfirmWeekend] = useState(false);
  const [busy, setBusy] = useState(false);

  const remove = async (scope: "day" | "group") => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/plan/day-scenario/saved?date=${encodeURIComponent(date)}&scope=${scope}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
      const { dates } = (await response.json()) as { dates: string[] };
      invalidatePlanDayMarkers();
      for (const changed of dates) requestPlanRefetchForDate(changed);
      toast.success(scope === "group" ? "Выходные удалены из плана" : "День удалён из плана");
    } catch {
      toast.error("Не удалось удалить. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
      setMenuOpen(false);
      setConfirmWeekend(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-[22px] border border-[var(--mp-line)] bg-[var(--mp-card)] px-4 py-3">
      <Sparkles className="h-[18px] w-[18px] shrink-0 text-[var(--mp-ac)]" strokeWidth={1.8} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="mp-font-ui m-0 text-[15px] font-semibold text-[var(--mp-tx)]">{savedDayTitle(date, count, pair !== null)}</p>
        {pair ? (
          <button type="button" onClick={() => onOpenDate(pair.date)} className={`mp-font-ui -ml-1 mt-0.5 inline-flex min-h-8 items-center rounded-full px-1 text-[13.5px] font-semibold text-[var(--mp-ac-dark)] underline-offset-2 hover:underline ${PLAN_FOCUS}`}>
            {pairLinkLabel(pair)}
          </button>
        ) : null}
      </div>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Действия с днём от mamaGo" disabled={busy} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--mp-tx)] transition-colors hover:bg-[var(--mp-bg)] disabled:opacity-40 ${PLAN_FOCUS}`}>
            <MoreHorizontal className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[230px] rounded-2xl border border-[var(--mp-line)] bg-[var(--surface)] p-1.5 shadow-lg">
          {onEdit ? (
            <button
              type="button"
              className={MENU_ITEM}
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
            >
              Изменить день
            </button>
          ) : null}
          <button type="button" className={MENU_ITEM} onClick={() => void remove("day")}>Удалить этот день</button>
          {pair ? (
            <button
              type="button"
              className={MENU_ITEM}
              onClick={() => {
                setMenuOpen(false);
                setConfirmWeekend(true);
              }}
            >
              Удалить выходные
            </button>
          ) : null}
        </PopoverContent>
      </Popover>
      <AlertDialog open={confirmWeekend} onOpenChange={setConfirmWeekend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить выходные?</AlertDialogTitle>
            <AlertDialogDescription>Оба дня «от mamaGo» уйдут из плана. Ваши собственные записи на эти дни останутся.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Оставить</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove("group")}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
