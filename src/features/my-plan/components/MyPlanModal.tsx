"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMyPlan } from "../hooks/useMyPlan";
import { MyPlanPanelContent } from "./MyPlanPanelContent";

interface MyPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MyPlanModal({ open, onOpenChange }: MyPlanModalProps) {
  const { isLoading, accessPhase } = useMyPlan();

  const a11yTitle =
    isLoading || accessPhase === "loading"
      ? "Загрузка плана"
      : accessPhase === "no_children"
        ? "Добавьте ребенка"
        : "Мой план";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(92vw,960px)] !max-w-[960px] !max-h-[92vh] gap-0 overflow-hidden rounded-3xl border border-neutral-200/80 bg-neutral-50 p-0 shadow-2xl flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>{a11yTitle}</DialogTitle>
        </DialogHeader>

        <MyPlanPanelContent
          open={open}
          layout="desktop"
          onRequestClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
