"use client";

import { cn } from "@/lib/utils";
import { formShellContentWidthClass } from "./FormWizardHeader";

interface FormPrimaryContentCardProps {
  children: React.ReactNode;
  className?: string;
}

/** Main editor surface for the active step */
export function FormPrimaryContentCard({ children, className }: FormPrimaryContentCardProps) {
  return (
    <div className={cn(formShellContentWidthClass, "pt-6 pb-32", className)}>
      <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">{children}</div>
    </div>
  );
}
