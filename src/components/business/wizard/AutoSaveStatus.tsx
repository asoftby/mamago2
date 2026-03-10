"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutoSaveStatusProps {
  isSaving: boolean;
  isDirty: boolean;
  lastSaved: Date | null;
  error?: string | null;
  className?: string;
}

export function AutoSaveStatus({
  isSaving,
  isDirty,
  lastSaved,
  error,
  className,
}: AutoSaveStatusProps) {
  // Only show error messages - everything else is silent
  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <AlertCircle className="h-4 w-4 text-red-500" />
        <span className="text-red-600">Ошибка сохранения</span>
      </div>
    );
  }

  // Silent autosave - no success messages
  return null;
}