"use client";

import { cn } from "@/lib/utils";
import { formShellContentWidthClass } from "./FormWizardHeader";

interface FormPrimaryContentCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Main editor surface for the active step.
 *
 * Mobile intentionally uses the whole viewport width: the form itself supplies
 * the readable 16px inset instead of nesting a padded card inside a padded page.
 */
export function FormPrimaryContentCard({ children, className }: FormPrimaryContentCardProps) {
  return (
    <div
      className={cn(
        formShellContentWidthClass,
        "pb-40 pt-3 sm:px-6 sm:pb-32 sm:pt-6 lg:px-8",
        className,
      )}
    >
      <div className="bg-card px-4 py-5 sm:rounded-xl sm:border sm:p-6 sm:shadow-sm lg:p-8">
        {children}
      </div>
    </div>
  );
}
