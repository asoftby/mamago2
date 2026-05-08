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
          "inline-flex items-center justify-center gap-1.5 text-sm transition",
          variant === "primary" &&
            "rounded-2xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary/90 active:scale-[0.98]",
          variant === "warning" &&
            "rounded-2xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary/90 active:scale-[0.98]",
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
