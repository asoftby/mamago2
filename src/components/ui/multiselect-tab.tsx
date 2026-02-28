"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type MultiSelectOption = {
  id: string
  label: string
}

export type MultiSelectTabValue = string[]

function formatTabLabel(title: string, selectedLabels: string[]): string {
  if (selectedLabels.length === 0) return title

  if (selectedLabels.length === 1) {
    return selectedLabels[0]
  }

  // больше одного
  return `${selectedLabels[0]} +${selectedLabels.length - 1}`
}

export function MultiSelectTab({
  title,
  options,
  value,
  onChange,
  className,
}: {
  title: string
  options: MultiSelectOption[]
  value: MultiSelectTabValue
  onChange: (next: MultiSelectTabValue) => void
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  const selected = React.useMemo(() => new Set(value), [value])
  const selectedLabels = React.useMemo(() => {
    const map = new Map(options.map(o => [o.id, o.label]))
    return value.map(id => map.get(id)).filter(Boolean) as string[]
  }, [options, value])

  const label = formatTabLabel(title, selectedLabels)
  const hasValue = value.length > 0

  const toggle = (id: string) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange(Array.from(next))
  }

  const clearAll = () => onChange([])

  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          "inline-flex items-center gap-2",
          "h-11 px-5 rounded-full border bg-background",
          "text-sm font-medium text-foreground transition-colors",
          hasValue ? "border-primary/50 bg-primary/50" : "border-border"
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="max-w-[220px] truncate">{label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            open ? "rotate-180" : "rotate-0",
            hasValue && "text-foreground"
          )}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.24 4.5a.75.75 0 0 1-1.08 0l-4.24-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(320px,calc(100vw-32px))] rounded-2xl border bg-background p-3 shadow-lg"
          role="menu"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{title}</div>
            <button
              type="button"
              onClick={clearAll}
              disabled={!hasValue}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              Сбросить
            </button>
          </div>

          <div className="mt-3 space-y-1 max-h-64 overflow-auto">
            {options.map((opt) => {
              const checked = selected.has(opt.id)
              return (
                <div key={opt.id} className="block">
                  <button
                    type="button"
                    onClick={() => toggle(opt.id)}
                  className="w-full rounded-xl px-3 py-2 text-left hover:bg-foreground/5 transition-colors"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "h-4 w-4 rounded border transition-colors",
                        checked
                          ? "bg-primary border-primary"
                          : "border-border"
                      )}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </div>
                </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
