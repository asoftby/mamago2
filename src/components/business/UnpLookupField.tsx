"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type LookupResult = {
  legalName: string | null;
  source: string | null;
};

interface UnpLookupFieldProps {
  id?: string;
  name?: string;
  label: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  helperText?: string;
  fieldError?: string;
  debounceMs?: number;
  onValueChange: (value: string) => void;
  onResolved?: (result: LookupResult) => void;
  onReset?: () => void;
}

export function UnpLookupField({
  id = "unp",
  name,
  label,
  value,
  required = false,
  disabled = false,
  placeholder = "123456789",
  helperText = "9 цифр",
  fieldError,
  debounceMs = 700,
  onValueChange,
  onResolved,
  onReset,
}: UnpLookupFieldProps) {
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
      }
    };
  }, []);

  const runLookup = async (unp: string) => {
    setIsLookupLoading(true);
    setLookupError("");

    try {
      const response = await fetch(`/api/company/unp-lookup?unp=${unp}`);
      if (!response.ok) {
        throw new Error(`UNP lookup failed: ${response.status}`);
      }

      const json = (await response.json()) as {
        ok: boolean;
        found: boolean;
        legalName: string | null;
        source: string | null;
      };

      if (!json.ok) {
        throw new Error("UNP lookup failed");
      }

      if (json.legalName) {
        onResolved?.({
          legalName: json.legalName,
          source: json.source,
        });
      } else {
        setLookupError("Не удалось быстро определить название. Заполните вручную — мы проверим данные при модерации.");
        onResolved?.({
          legalName: null,
          source: null,
        });
      }
    } catch (error) {
      console.error("[UnpLookupField] Lookup failed:", error);
      setLookupError("Не удалось быстро определить название. Заполните вручную — мы проверим данные при модерации.");
      onResolved?.({
        legalName: null,
        source: null,
      });
    } finally {
      setIsLookupLoading(false);
    }
  };

  const scheduleLookup = (unp: string) => {
    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    if (unp.length !== 9) {
      setLookupError("");
      setIsLookupLoading(false);
      onReset?.();
      return;
    }

    lookupTimeoutRef.current = setTimeout(() => {
      void runLookup(unp);
    }, debounceMs);
  };

  const handleChange = (nextValue: string) => {
    const cleaned = nextValue.replace(/\D/g, "").slice(0, 9);
    onValueChange(cleaned);
    scheduleLookup(cleaned);
  };

  const handleBlur = () => {
    const cleaned = value.replace(/\D/g, "").slice(0, 9);
    if (cleaned.length === 9 && !isLookupLoading) {
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
      }
      void runLookup(cleaned);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <Input
          type="text"
          id={id}
          name={name}
          required={required}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          pattern="[0-9]{9}"
          maxLength={9}
          className="pr-10"
          placeholder={placeholder}
          inputMode="numeric"
          disabled={disabled}
        />
        {isLookupLoading ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : null}
      </div>

      {isLookupLoading ? (
        <p className="mt-1 text-xs text-gray-600">Пробуем определить организацию автоматически…</p>
      ) : null}

      {!isLookupLoading && lookupError ? (
        <p className="mt-1 text-xs text-amber-600">{lookupError}</p>
      ) : null}

      {fieldError ? <p className="mt-1 text-sm text-red-600">{fieldError}</p> : null}

      {!isLookupLoading && !lookupError && !fieldError ? (
        <p className="mt-1 text-xs text-gray-500">{helperText}</p>
      ) : null}
    </div>
  );
}
