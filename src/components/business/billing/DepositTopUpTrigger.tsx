"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { DepositTopUpModal } from "./DepositTopUpModal";

interface DepositTopUpTriggerProps {
  balance: number;
  lowBalanceThreshold: number;
  promotionHref: string;
  /** Visual variant for different entry points */
  variant?: "primary" | "warning" | "ghost";
  label?: string;
  className?: string;
}

export function DepositTopUpTrigger({
  balance,
  lowBalanceThreshold,
  promotionHref,
  variant = "primary",
  label = "Пополнить баланс",
  className,
}: DepositTopUpTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition",
          variant === "primary" &&
            "border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 hover:border-stone-300",
          variant === "warning" &&
            "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-300",
          variant === "ghost" &&
            "text-stone-500 hover:text-stone-800 underline underline-offset-2",
          className,
        )}
      >
        {label}
      </button>

      {open && (
        <DepositTopUpModal
          balance={balance}
          lowBalanceThreshold={lowBalanceThreshold}
          promotionHref={promotionHref}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
