"use client";

import { useState, type ReactNode } from "react";
import { CallModal } from "@/components/shared/CallModal";
import type { NormalizedPhone } from "@/lib/phones/normalizePhones";

export function CallActionButton({
  phones,
  subtitle,
  className,
  children,
}: {
  phones: NormalizedPhone[];
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (phones.length === 0) return null;

  if (phones.length === 1) {
    return (
      <a href={phones[0].href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>

      <CallModal open={open} onOpenChange={setOpen} phones={phones} subtitle={subtitle} />
    </>
  );
}
