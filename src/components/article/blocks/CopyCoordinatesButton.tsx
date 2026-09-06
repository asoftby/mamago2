"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCoordinatesButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1700);
        });
      }}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-foreground/40"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Скопировано" : "Координаты"}
    </button>
  );
}
