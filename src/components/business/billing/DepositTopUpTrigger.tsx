"use client";

import { useState } from "react";
import { BUSINESS_CTA_SOLID } from "@/components/business/ui/businessCta";
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
            cn("rounded-2xl px-5 py-3 font-semibold active:scale-[0.98]", BUSINESS_CTA_SOLID),
          variant === "warning" &&
            cn("rounded-2xl px-5 py-3 font-semibold active:scale-[0.98]", BUSINESS_CTA_SOLID),
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
