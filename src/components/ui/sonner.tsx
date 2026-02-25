"use client"

import { Toaster } from "sonner"

export function Sonner() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      duration={2500}
    />
  )
}
