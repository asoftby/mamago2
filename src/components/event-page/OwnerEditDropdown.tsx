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
import { editorEventEditHref } from "@/lib/content-editor/types";
import {
  EVENT_WIZARD_STEPS,
  TOTAL_EVENT_WIZARD_STEPS,
} from "@/components/business/wizard/event/eventWizardSteps.config";
import { businessFormCopy } from "@/components/business/wizard/businessFormLabels";
import { cn } from "@/lib/utils";

/**
 * Выбор шага редактирования с страницы публикации (не только «с последнего места»).
 */
export function OwnerEditDropdown({
  eventId,
  className,
}: {
  eventId: string;
  className?: string;
}) {
  const base = editorEventEditHref(eventId);

  const items = [
    ...EVENT_WIZARD_STEPS.map((s) => ({
      href: `${base}?step=${encodeURIComponent(String(s.id))}`,
      label: s.title,
    })),
    {
      href: `${base}?step=${TOTAL_EVENT_WIZARD_STEPS}`,
      label: businessFormCopy.reviewStepShortTitle,
    },
  ];

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
