"use client";

import { useEffect, useRef, useState } from "react";

interface PhoneInputByMaskProps {
  valueE164: string;
  onChangeE164: (value: string) => void;
  disabled?: boolean;
}

/**
 * Phone input with E.164 normalization and BY mask formatting.
 * - Always keeps leading "+"
 * - Default value when empty: "+375"
 * - For +375: displays as "+375 (AA) BBB-CC-DD"
 * - For other countries: displays as "+" + digits
 */
export function PhoneInputByMask({
  valueE164,
  onChangeE164,
  disabled = false,
}: PhoneInputByMaskProps) {
  const [displayValue, setDisplayValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize to E.164: "+" + digits only
  const normalizeToE164 = (input: string): string => {
    const digits = input.replace(/\D/g, "");
    return "+" + digits;
  };

  // Format for display
  const formatForDisplay = (e164: string): string => {
    const digits = e164.slice(1); // Remove leading "+"

    // BY mask: +375 (AA) BBB-CC-DD
    if (digits.startsWith("375")) {
      const rest = digits.slice(3); // After "375"
      let formatted = "+375";

      if (rest.length > 0) {
        formatted += " (" + rest.slice(0, 2);
        if (rest.length > 2) {
          formatted += ") " + rest.slice(2, 5);
          if (rest.length > 5) {
            formatted += "-" + rest.slice(5, 7);
            if (rest.length > 7) {
              formatted += "-" + rest.slice(7, 9);
            }
          }
        } else if (rest.length === 2) {
          formatted += ")";
        }
      }

      return formatted;
    }

    // Other countries: just "+" + digits
    return e164;
  };

  // Sync display value when valueE164 changes externally
  useEffect(() => {
    setDisplayValue(formatForDisplay(valueE164 || "+375"));
  }, [valueE164]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;

    // Ensure leading "+" is always present
    if (!input.startsWith("+")) {
      input = "+" + input.replace(/\D/g, "");
    }

    const normalized = normalizeToE164(input);
    const formatted = formatForDisplay(normalized);

    setDisplayValue(formatted);
    onChangeE164(normalized);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent deleting the "+"
    if (
      e.key === "Backspace" &&
      inputRef.current &&
      inputRef.current.selectionStart === 1 &&
      inputRef.current.selectionEnd === 1
    ) {
      e.preventDefault();
    }
  };

  return (
    <input
      ref={inputRef}
      type="tel"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed text-base"
      placeholder="+375 (29) 123-45-67"
    />
  );
}
