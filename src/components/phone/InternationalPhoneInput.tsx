"use client";

import { useRef, type ClipboardEvent, type FocusEvent } from "react";
import PhoneInput from "react-phone-number-input";
import type { CountryCode } from "libphonenumber-js";

import { normalizePhoneToE164, resolvePhoneInputToE164 } from "@/lib/phone/e164";
import { normalizeInternationalPhoneInputInitialValue } from "./internationalPhoneInputValue";
import { cn } from "@/lib/utils";
import "./international-phone-input.css";

const DEFAULT_COUNTRY = "BY" satisfies CountryCode;

export interface InternationalPhoneInputProps {
  id?: string;
  /** E.164 or empty string */
  value: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  "aria-invalid"?: boolean;
}

export function InternationalPhoneInput({
  id,
  value,
  onChange,
  disabled,
  className,
  placeholder = "+375 29 123 45 67",
  "aria-invalid": ariaInvalid,
}: InternationalPhoneInputProps) {
  const countryRef = useRef<CountryCode>(DEFAULT_COUNTRY);
  const normalizedValue = normalizePhoneToE164(value);

  return (
    <div
      data-slot="international-phone-input"
      className={cn(
        "international-phone-field w-full",
        ariaInvalid && "international-phone-field--invalid",
        className,
      )}
    >
      <PhoneInput
        id={id}
        international
        defaultCountry={DEFAULT_COUNTRY}
        countryCallingCodeEditable
        smartCaret
        limitMaxLength
        autoComplete="tel"
        placeholder={placeholder}
        value={normalizeInternationalPhoneInputInitialValue(value)}
        onChange={(v) => onChange(normalizePhoneToE164(v ?? ""))}
        onCountryChange={(c) => {
          countryRef.current = (c ?? DEFAULT_COUNTRY) as CountryCode;
        }}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        numberInputProps={{
          inputMode: "tel",
          onPaste: (e: ClipboardEvent<HTMLInputElement>) => {
            const text = e.clipboardData.getData("text/plain");
            const next = resolvePhoneInputToE164(text, countryRef.current);
            if (next) {
              e.preventDefault();
              onChange(next);
            }
          },
          onBlur: (e: FocusEvent<HTMLInputElement>) => {
            const raw = e.currentTarget.value;
            const next = resolvePhoneInputToE164(raw, countryRef.current);
            if (next && next !== normalizedValue) {
              onChange(next);
            }
          },
        }}
      />
    </div>
  );
}
