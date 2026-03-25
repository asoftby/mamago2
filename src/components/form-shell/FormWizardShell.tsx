"use client";

import { cn } from "@/lib/utils";

interface FormWizardShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Outer frame for multi-step entity editors: background + full-height column.
 */
export function FormWizardShell({ children, className }: FormWizardShellProps) {
  return <div className={cn("min-h-screen bg-muted/40", className)}>{children}</div>;
}
