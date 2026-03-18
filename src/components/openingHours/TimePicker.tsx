"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Clock, Edit3 } from "lucide-react";

interface TimePickerProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Generate time options in 15-minute intervals
 */
function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      options.push(`${h}:${m}`);
    }
  }
  return options;
}

/**
 * Validate and normalize time input
 */
function normalizeTime(input: string): { valid: boolean; normalized?: string; error?: string } {
  if (!input || typeof input !== "string") {
    return { valid: false, error: "Введите время в формате 09:00" };
  }

  // Remove whitespace
  const cleaned = input.trim();
  
  // Check for basic format with colon
  if (!cleaned.includes(":")) {
    return { valid: false, error: "Введите время в формате 09:00" };
  }

  // Split by colon
  const parts = cleaned.split(":");
  if (parts.length !== 2) {
    return { valid: false, error: "Введите время в формате 09:00" };
  }

  const [hourStr, minuteStr] = parts;

  // Check if parts are numeric
  if (!/^\d+$/.test(hourStr) || !/^\d+$/.test(minuteStr)) {
    return { valid: false, error: "Введите время в формате 09:00" };
  }

  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // Validate ranges
  if (hour < 0 || hour > 23) {
    return { valid: false, error: "Введите время в формате 09:00" };
  }

  if (minute < 0 || minute > 59) {
    return { valid: false, error: "Введите время в формате 09:00" };
  }

  // Normalize to HH:MM format
  const normalized = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  
  return { valid: true, normalized };
}

const TIME_OPTIONS = generateTimeOptions();

/**
 * TimePicker component
 * Allows selecting time from dropdown or manual input with validation
 */
export function TimePicker({ value, onChange, disabled, placeholder = "Выберите время" }: TimePickerProps) {
  const [isManualMode, setIsManualMode] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update input value when external value changes and determine initial mode
  useEffect(() => {
    const updateValue = () => {
      if (!isManualMode) {
        setInputValue(value);
      }
      
      // If the current value is not in standard options, switch to manual mode
      if (value && !TIME_OPTIONS.includes(value) && !isManualMode) {
        setIsManualMode(true);
        setInputValue(value);
      }
    };

    requestAnimationFrame(updateValue);
  }, [value, isManualMode]);

  const handleSelectChange = (newValue: string) => {
    onChange(newValue);
    setError(null);
  };

  const handleManualModeToggle = () => {
    if (isManualMode) {
      // Switching back to select mode - validate and commit current input
      const result = normalizeTime(inputValue);
      
      if (result.valid && result.normalized) {
        onChange(result.normalized);
        setInputValue(result.normalized);
        setError(null);
        
        // Only switch to select mode if the time is in standard options
        if (TIME_OPTIONS.includes(result.normalized)) {
          setIsManualMode(false);
        }
        // If time is not in standard options, stay in manual mode but clear error
      } else {
        setError(result.error || "Введите время в формате 09:00");
      }
    } else {
      // Switching to manual mode
      setIsManualMode(true);
      setInputValue(value);
      setError(null);
      // Focus input after state update
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // If the value already contains a colon and looks like valid time format, be more careful
    if (value.includes(':') && /^\d{1,2}:\d{0,2}$/.test(value)) {
      // Allow editing of existing valid format
      setInputValue(value);
      setError(null);
      return;
    }
    
    // Remove all non-digits for masking
    const digits = value.replace(/\D/g, '');
    
    // Apply mask based on number of digits
    if (digits.length === 0) {
      value = '';
    } else if (digits.length === 1) {
      value = digits;
    } else if (digits.length === 2) {
      value = digits;
    } else if (digits.length === 3) {
      value = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    } else if (digits.length >= 4) {
      value = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
    }
    
    setInputValue(value);
    setError(null);
  };

  const handleInputBlur = () => {
    const result = normalizeTime(inputValue);
    
    if (result.valid && result.normalized) {
      onChange(result.normalized);
      setInputValue(result.normalized);
      setError(null);
      
      // Only switch back to select mode if the time is in the standard options
      if (TIME_OPTIONS.includes(result.normalized)) {
        setIsManualMode(false);
      }
      // If time is not in standard options (e.g., 12:37), stay in manual mode
    } else {
      setError(result.error || "Введите время в формате 09:00");
    }
  };

  const handleInputPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    // Try to extract time from pasted text
    const timeMatch = pastedText.match(/(\d{1,2}):?(\d{0,2})/);
    if (timeMatch) {
      const [, hours, minutes = ''] = timeMatch;
      const digits = hours + minutes;
      
      // Apply the same mask logic
      let maskedValue = '';
      if (digits.length === 0) {
        maskedValue = '';
      } else if (digits.length === 1) {
        maskedValue = digits;
      } else if (digits.length === 2) {
        maskedValue = digits;
      } else if (digits.length === 3) {
        maskedValue = `${digits.slice(0, 2)}:${digits.slice(2)}`;
      } else if (digits.length >= 4) {
        maskedValue = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
      }
      
      setInputValue(maskedValue);
      setError(null);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInputBlur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInputValue(value);
      setError(null);
      setIsManualMode(false);
    } else if (e.key === "Backspace") {
      // Allow backspace to work naturally with the mask
      return;
    } else if (e.key === "Delete") {
      // Allow delete to work naturally
      return;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
      // Allow navigation keys
      return;
    } else if (e.key === "Tab") {
      // Allow tab navigation
      return;
    } else if (!/\d/.test(e.key)) {
      // Block non-digit keys (except special keys handled above)
      e.preventDefault();
    }
  };

  if (isManualMode) {
    return (
      <div className="relative">
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onPaste={handleInputPaste}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            placeholder="09:00"
            className={`w-[90px] text-center ${error ? "border-red-500" : ""}`}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleManualModeToggle}
            disabled={disabled}
            className="h-9 w-9 p-0 flex-shrink-0"
          >
            <Clock className="h-4 w-4" />
          </Button>
        </div>
        {error && (
          <div className="absolute top-full left-0 mt-1 text-xs text-red-600 whitespace-nowrap z-10">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={value} onValueChange={handleSelectChange} disabled={disabled}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-white">
          {TIME_OPTIONS.map((time) => (
            <SelectItem key={time} value={time}>
              {time}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleManualModeToggle}
        disabled={disabled}
        className="h-9 w-9 p-0 flex-shrink-0"
        title="Ввести время вручную"
      >
        <Edit3 className="h-4 w-4" />
      </Button>
    </div>
  );
}
