"use client";

import { useState } from "react";
import { ChevronDown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarGroupProps {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  sidebarVariant?: "admin" | "business";
  /** Uncontrolled: initial open state (ignored when isOpen/onToggle are provided) */
  defaultOpen?: boolean;
  /** Whether any child is currently active (affects parent icon/text colour) */
  isActive?: boolean;
  hasAttention?: boolean;
  /** Controlled open state. When provided, internal state is bypassed. */
  isOpen?: boolean;
  /** Controlled toggle handler. Required when isOpen is provided. */
  onToggle?: () => void;
}

export function SidebarGroup({
  icon: Icon,
  label,
  children,
  sidebarVariant = "admin",
  defaultOpen = false,
  isActive = false,
  hasAttention = false,
  isOpen: controlledOpen,
  onToggle,
}: SidebarGroupProps) {
  const controlled = controlledOpen !== undefined;

  // Uncontrolled state — used only when no controlled props are given
  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const open = controlled ? controlledOpen : internalOpen;
  const handleToggle = controlled
    ? (onToggle ?? (() => {}))
    : () => setInternalOpen((p) => !p);

  const groupStateClass =
    sidebarVariant === "business"
      ? isActive
        ? "bg-[#EAF7FC] text-slate-950"
        : open
          ? "bg-[#EAF7FC] text-slate-950"
          : "text-slate-600 hover:bg-sky-50 hover:text-slate-950"
      : isActive
        ? "bg-slate-100 text-slate-950"
        : open
          ? "bg-slate-100 text-slate-950"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950";

  const groupIconClass =
    sidebarVariant === "business"
      ? isActive || open
        ? "text-sky-700"
        : "text-current"
      : isActive || open
        ? "text-slate-700"
        : "text-current";

  const groupChevronClass =
    sidebarVariant === "business"
      ? isActive || open
        ? "text-slate-600"
        : "text-current"
      : isActive || open
        ? "text-slate-600"
        : "text-current";

  return (
    <div>
      <button
        onClick={handleToggle}
        className={cn(
          "relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-150",
          groupStateClass
        )}
      >
        <div className="relative flex flex-col items-center flex-shrink-0">
          {hasAttention && (
            <span
              className="mb-[3px] w-1 h-1 bg-red-500 rounded-full flex-shrink-0"
              title="Требуется внимание"
              aria-hidden
            />
          )}
          <Icon
            className={cn(
              "w-5 h-5 flex-shrink-0",
              groupIconClass
            )}
          />
        </div>
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 flex-shrink-0 transition-transform duration-200",
            groupChevronClass,
            open && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-[500px] opacity-100 mt-1" : "max-h-0 opacity-0"
        )}
      >
        <div className="flex flex-col gap-1 py-1">
          {children}
        </div>
      </div>
    </div>
  );
}
