"use client";

import { Info } from "lucide-react";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { cn } from "@/lib/utils";

interface BusinessSectionHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  /** Цвет eyebrow: 'default' (серый) или 'primary' */
  eyebrowVariant?: "default" | "primary";
  /**
   * @deprecated Back + crumbs live in BusinessShell via BusinessCabinetNav.
   * Kept optional so existing call sites keep compiling; ignored.
   */
  showBack?: boolean;
  /** @deprecated Ignored — see showBack. */
  backFallbackHref?: string;
}

export function BusinessSectionHeader({
  eyebrow,
  title,
  description,
  actions,
  eyebrowVariant = "default",
}: BusinessSectionHeaderProps) {
  return (
    <>
      <BusinessSurfaceCard className="relative overflow-hidden px-6 py-6 md:px-7 md:py-7">
        <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(251,191,36,0.08)_0%,rgba(255,255,255,0)_100%)]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl space-y-2">
            {eyebrow ? (
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.2em]",
                  eyebrowVariant === "primary" ? "text-primary" : "text-stone-400",
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950 md:text-[2rem]">
              {title}
            </h1>
          </div>
          {actions ? (
            <div className="relative w-full shrink-0 md:w-auto">{actions}</div>
          ) : null}
        </div>
      </BusinessSurfaceCard>
      {/*
        Note sits between the cabinet card and the next page section.
        Keep items-start + icon mt-1 for multi-line copy.
        Typography matches SettingsLinkRow subtitle (text-xs muted).
      */}
      <div
        role="note"
        className="mt-6 flex max-w-3xl items-start gap-2 text-xs leading-5 text-neutral-400"
      >
        <Info
          className="mt-1 h-3.5 w-3.5 shrink-0 text-neutral-400"
          aria-hidden
        />
        <p className="m-0">{description}</p>
      </div>
    </>
  );
}
