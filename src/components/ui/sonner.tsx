"use client"

import { Toaster } from "sonner"

export function Sonner() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      duration={2500}
      toastOptions={{
        classNames: {
          toast:
            "items-start gap-3 !rounded-xl !py-3 !pl-3 !pr-12 !shadow-md",
          closeButton:
            "!absolute !left-auto !right-2 !top-2 !h-7 !w-7 rounded-full border border-neutral-200/90 bg-white/95 text-neutral-600 shadow-sm",
        },
      }}
    />
  )
}
