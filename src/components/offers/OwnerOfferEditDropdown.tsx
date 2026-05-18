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
import { businessFormCopy } from "@/components/business/wizard/businessFormLabels";
import { getStepsForOfferType } from "@/components/business/wizard/offer/offerWizardSteps.config";
import type { OfferType } from "@/lib/offer/offerPageTypes";
import { editorOfferEditHref } from "@/lib/content-editor/types";
import { cn } from "@/lib/utils";

export function OwnerOfferEditDropdown({
  offerId,
  offerType,
  className,
}: {
  offerId: string;
  offerType: OfferType;
  className?: string;
}) {
  const base = editorOfferEditHref(offerId);
  const steps = getStepsForOfferType(offerType);

  const reviewStepIndex = steps.findIndex((step) => step.key === "review");

  const items = [
    ...steps.map((step, index) => ({
      href: `${base}?step=${encodeURIComponent(String(index + 1))}`,
      label: step.title,
    })),
  ];

  if (reviewStepIndex >= 0) {
    items[reviewStepIndex] = {
      href: `${base}?step=${encodeURIComponent(String(reviewStepIndex + 1))}`,
      label: businessFormCopy.reviewStepShortTitle,
    };
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            className,
            "border-black bg-black text-white shadow-none hover:bg-neutral-900 hover:text-white [&_svg]:text-white",
          )}
          aria-haspopup="menu"
        >
          Редактировать
          <ChevronDown className="ml-1 size-4 shrink-0" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(70vh,420px)] overflow-y-auto border-border bg-popover p-2 text-popover-foreground shadow-md"
      >
        {items.map((it) => (
          <DropdownMenuItem key={it.href} className="cursor-pointer p-0">
            <Link
              href={it.href}
              className="block w-full px-3 py-2.5 text-left text-sm"
            >
              {it.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
