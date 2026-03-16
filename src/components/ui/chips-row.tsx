"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type ChipItem = {
  id: string
  label: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function ChipsRow({
  items,
  className,
}: {
  items: ChipItem[]
  className?: string
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap py-2 no-scrollbar">
        {items.map((it) => {
          const isActive = !!it.active
          return (
            <button
              key={it.id}
              type="button"
              disabled={it.disabled}
              onClick={it.onClick}
              className={cn(
                "h-[2.75rem] px-5 rounded-full border bg-background",
                "text-sm font-medium text-foreground",
                "transition-colors",
                "disabled:opacity-50 disabled:pointer-events-none",
                isActive ? "border-primary/50 bg-primary/50" : "border-border"
              )}
            >
              {it.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
