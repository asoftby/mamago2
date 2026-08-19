"use client";

import type { ReactNode } from "react";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { Label } from "@/components/ui/label";
import { getRichTextLength } from "@/lib/richtext/utils";
import { cn } from "@/lib/utils";

interface WizardRichTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: ReactNode;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  minHeight?: number;
  className?: string;
  labelClassName?: string;
  required?: boolean;
}

export function WizardRichTextField({
  label,
  value,
  onChange,
  helperText,
  placeholder,
  error,
  disabled = false,
  readOnly = false,
  maxLength,
  minHeight = 140,
  className,
  labelClassName,
  required = false,
}: WizardRichTextFieldProps) {
  const charCount = getRichTextLength(value);
  const exceedsLimit = typeof maxLength === "number" && charCount > maxLength;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label className={cn("text-sm font-medium text-foreground", labelClassName)}>
            {label}
            {required ? <span className="text-red-500"> *</span> : null}
          </Label>
          {helperText ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{helperText}</p>
          ) : null}
        </div>
        {(typeof maxLength === "number" || charCount > 0) && (
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums text-muted-foreground",
              exceedsLimit && "text-destructive",
            )}
          >
            {charCount}
            {typeof maxLength === "number" ? `/${maxLength}` : ""} символов
          </span>
        )}
      </div>

      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        error={error || (exceedsLimit ? `Превышен лимит символов (${maxLength})` : undefined)}
        disabled={disabled}
        readOnly={readOnly}
        compact
        minHeight={minHeight}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
