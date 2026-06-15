"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type OwnerWizardEditStep = {
  href: string;
  label: string;
};

const triggerClassName =
  "border-black bg-black text-white shadow-none hover:bg-neutral-900 hover:text-white [&_svg]:text-white";

const contentClassName =
  "w-[var(--radix-popover-trigger-width)] min-w-0 max-h-[min(70vh,420px)] overflow-y-auto border-border bg-popover p-0 font-mono text-popover-foreground shadow-md";

function formatStepNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function OwnerWizardEditDropdown({
  steps,
  className,
  label = "Редактировать",
}: {
  steps: OwnerWizardEditStep[];
  className?: string;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full font-mono text-[14px] font-medium tracking-normal",
            triggerClassName,
            className,
          )}
          aria-haspopup="menu"
        >
          {label}
          <ChevronDown className="ml-1 size-4 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className={contentClassName}>
        <div className="flex flex-col divide-y divide-[rgba(20,18,16,0.10)]">
          {steps.map((step, index) => (
            <DropdownMenuItem
              key={step.href}
              className="cursor-pointer p-0 focus:bg-transparent data-[highlighted]:bg-transparent"
            >
              <Link
                href={step.href}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-[13px] text-[#141210] transition-colors hover:bg-[#FAF7F1]"
              >
                <span className="min-w-0">{step.label}</span>
                <span className="shrink-0 text-[11px] text-[rgba(20,18,16,0.55)]">
                  {formatStepNumber(index)}
                </span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
