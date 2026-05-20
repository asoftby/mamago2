"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Desktop panel width variants */
const PANEL_WIDTH: Record<AdminSidePanelSize, string> = {
  sm: "sm:max-w-[480px]",
  md: "sm:max-w-[560px]",
  lg: "sm:max-w-[640px]",
  xl: "sm:max-w-[800px]",
};

export type AdminSidePanelSize = "sm" | "md" | "lg" | "xl";

export interface AdminSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Panel header title */
  title: string;
  /** Optional subtitle rendered below the title */
  description?: React.ReactNode;
  /** Panel width on desktop (default "md" = 560px) */
  size?: AdminSidePanelSize;
  /** Content rendered in the sticky footer */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Reusable right-side admin panel.
 *
 * - Overlay: soft blur + slate tint (no full-black screen).
 * - Animations: overlay fade, panel slide-from-right.
 * - Focus trap + Escape close via Radix Dialog primitives.
 * - Body scroll is locked while panel is open (Radix handles this).
 * - Use instead of raw `fixed inset-0 bg-black` overlays in admin sections.
 */
export function AdminSidePanel({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  footer,
  children,
}: AdminSidePanelProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* ── Blur overlay ─────────────────────────────────────────────── */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50",
            "bg-slate-900/[0.18] backdrop-blur-[5px]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:duration-300 data-[state=closed]:duration-200",
          )}
        />

        {/* ── Slide-in panel ───────────────────────────────────────────── */}
        <Dialog.Content
          className={cn(
            // Layout
            "fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col",
            // Visual
            "border-l border-gray-200 bg-white shadow-2xl",
            // Desktop width
            PANEL_WIDTH[size],
            // Animations
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
            "data-[state=open]:duration-300 data-[state=closed]:duration-200",
            "ease-in-out",
            // Remove default focus ring (we have visible header)
            "focus:outline-none",
          )}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex shrink-0 items-center gap-4 border-b border-gray-200 px-6 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold leading-snug text-gray-900">
                {title}
              </Dialog.Title>
              {description != null && (
                <Dialog.Description asChild>
                  <p className="mt-0.5 text-sm leading-snug text-gray-500">
                    {description}
                  </p>
                </Dialog.Description>
              )}
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Закрыть"
                className="flex-shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* ── Scrollable content ─────────────────────────────────────── */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>

          {/* ── Optional footer ────────────────────────────────────────── */}
          {footer != null && (
            <div className="shrink-0 border-t border-gray-200 px-6 py-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
