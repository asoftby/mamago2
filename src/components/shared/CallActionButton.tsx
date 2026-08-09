"use client";

import { useState, type ReactNode } from "react";
import { CallModal } from "@/components/shared/CallModal";
import type { NormalizedPhone } from "@/lib/phones/normalizePhones";

export function CallActionButton({
  phones,
  subtitle,
  className,
  children,
  onClick,
}: {
  phones: NormalizedPhone[];
  subtitle?: string;
  className?: string;
  children: ReactNode;
  /** Optional analytics hook, fired before the call/tel: action, e.g. a CTA_CLICK track call. */
  onClick?: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (phones.length === 0) return null;

  if (phones.length === 1) {
    return (
      <a href={phones[0].href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          onClick?.();
          setOpen(true);
        }}
      >
        {children}
      </button>

      <CallModal open={open} onOpenChange={setOpen} phones={phones} subtitle={subtitle} />
    </>
  );
}
