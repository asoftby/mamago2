"use client";

import { useState, useEffect } from "react";
import { ChevronDown, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarGroupProps {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  hasAttention?: boolean;
}

export function SidebarGroup({
  icon: Icon,
  label,
  children,
  defaultOpen = false,
  hasAttention = false,
}: SidebarGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-150",
          isOpen
            ? "bg-gray-50 text-gray-900"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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
          <Icon className="w-5 h-5 flex-shrink-0" />
        </div>
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 flex-shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[500px] opacity-100 mt-1" : "max-h-0 opacity-0"
        )}
      >
        <div className="flex flex-col gap-1 py-1">
          {children}
        </div>
      </div>
    </div>
  );
}
