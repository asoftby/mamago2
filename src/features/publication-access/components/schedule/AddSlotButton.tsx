"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AddSlotButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  /** По умолчанию — внутри карточки дня */
  variant?: "default" | "footer";
};

export function AddSlotButton({
  onClick,
  disabled,
  className,
  variant = "default",
}: AddSlotButtonProps) {
  return (
    <Button
      type="button"
      variant={variant === "footer" ? "outline" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl text-primary hover:text-primary hover:bg-primary/10 border-primary/20",
        variant === "default" && "w-full justify-center gap-2 font-medium",
        className,
      )}
    >
      <Plus className="h-4 w-4 shrink-0" aria-hidden />
      Добавить слот
    </Button>
  );
}
