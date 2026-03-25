"use client";

import { useRef, useEffect } from "react";

interface Props {
  /** Raw digits after 375, e.g. "447777405" (9 digits) */
  value: string;
  onChange: (localDigits: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: boolean;
}

/**
 * Belarus phone input with a locked +375 prefix.
 * value/onChange deal only with the 9 digits AFTER the country code.
 * Parent stores full rawPhone as "375" + localDigits.
 */
export function PhoneInput({ value, onChange, autoFocus, disabled, error }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [autoFocus]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Only digits, max 9
    const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
    onChange(digits);
  }

  // Format the local part: XX XXX-XX-XX
  function formatLocal(d: string): string {
    const op = d.slice(0, 2);
    const p1 = d.slice(2, 5);
    const p2 = d.slice(5, 7);
    const p3 = d.slice(7, 9);
    let result = op;
    if (p1) result += " " + p1;
    if (p2) result += "-" + p2;
    if (p3) result += "-" + p3;
    return result;
  }

  return (
    <div
      className={[
        "flex h-12 bg-white border rounded-xl overflow-hidden transition-shadow",
        "focus-within:ring-2 focus-within:ring-[#EF8759]",
        error ? "border-red-400" : "border-neutral-200",
        disabled ? "opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Locked prefix */}
      <span className="flex items-center pl-4 pr-2 text-sm text-neutral-500 select-none whitespace-nowrap">
        +375
      </span>
      {/* Editable local part */}
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={formatLocal(value)}
        onChange={handleChange}
        disabled={disabled}
        placeholder="XX XXX-XX-XX"
        className="flex-1 pr-4 text-sm bg-transparent focus:outline-none placeholder:text-neutral-400"
      />
    </div>
  );
}
