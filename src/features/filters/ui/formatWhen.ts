/**
 * Safe date formatter for WhenSelect display values
 * Handles all edge cases to prevent NaN or "Invalid Date" from appearing
 */

type WhenValue = string | Date | { from: Date; to: Date } | null;

/**
 * Format a date as short Russian format (e.g., "5 мар.")
 * Returns null if date is invalid
 */
function formatDateSafe(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      return null;
    }
    
    // Use Intl.DateTimeFormat for consistent formatting
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
    });
    
    let formatted = formatter.format(d);
    
    // Ensure month has trailing dot
    const parts = formatted.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const day = parts[0];
      let month = parts[1];
      if (!month.endsWith(".")) {
        month = month + ".";
      }
      formatted = `${day} ${month}`;
    }
    
    return formatted.trim();
  } catch (error) {
    console.error("formatDateSafe error:", error);
    return null;
  }
}

/**
 * Check if two dates are the same day
 */
function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Format a date range (e.g., "5–7 мар." or "28 фев. — 2 мар.")
 */
function formatRangeSafe(from: Date, to: Date): string | null {
  const fromStr = formatDateSafe(from);
  const toStr = formatDateSafe(to);
  
  if (!fromStr || !toStr) return null;
  
  // Same month and year - compact format
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    const fromDay = from.getDate();
    const toDay = to.getDate();
    const month = fromStr.split(' ')[1]; // Get month part
    return `${fromDay}–${toDay} ${month}`;
  }
  
  // Different months - full format
  return `${fromStr} — ${toStr}`;
}

/**
 * Format WhenValue for display in WhenSelect
 * 
 * @param value - The when value (string preset, Date, range, or null)
 * @param placeholder - Placeholder text when no value (default: "Выберите...")
 * @returns Formatted display string, never returns NaN or "Invalid Date"
 * 
 * Examples:
 * - null → "Выберите..."
 * - "today" → "Сегодня • 5 мар."
 * - "tomorrow" → "Завтра • 6 мар."
 * - "weekend" → "Эти выходные • 9–10 мар."
 * - Date(2024-03-05) → "5 мар."
 * - { from: Date(...), to: Date(...) } → "5–7 мар."
 */
export function formatWhenValue(value: WhenValue, placeholder: string = "Выберите..."): string {
  if (!value) return placeholder;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // Handle string presets
  if (typeof value === 'string') {
    if (value === 'today') {
      const todayStr = formatDateSafe(today);
      return todayStr ? `Сегодня • ${todayStr}` : "Сегодня";
    }
    
    if (value === 'tomorrow') {
      const tomorrowStr = formatDateSafe(tomorrow);
      return tomorrowStr ? `Завтра • ${tomorrowStr}` : "Завтра";
    }
    
    if (value === 'weekend') {
      // Calculate weekend
      const day = now.getDay() === 0 ? 7 : now.getDay();
      const saturday = new Date(now);
      saturday.setDate(now.getDate() + (6 - day));
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);
      
      const weekendStr = formatRangeSafe(saturday, sunday);
      return weekendStr ? `Эти выходные • ${weekendStr}` : "Эти выходные";
    }
    
    // Unknown string preset - try to parse as date
    const parsed = formatDateSafe(value);
    return parsed || placeholder;
  }
  
  // Handle Date object
  if (value instanceof Date) {
    // Check if it's today
    if (isSameDay(value, today)) {
      const todayStr = formatDateSafe(value);
      return todayStr ? `Сегодня • ${todayStr}` : "Сегодня";
    }
    
    // Check if it's tomorrow
    if (isSameDay(value, tomorrow)) {
      const tomorrowStr = formatDateSafe(value);
      return tomorrowStr ? `Завтра • ${tomorrowStr}` : "Завтра";
    }
    
    // Regular date
    const dateStr = formatDateSafe(value);
    return dateStr || placeholder;
  }
  
  // Handle range object
  if (typeof value === 'object' && 'from' in value && 'to' in value) {
    const rangeStr = formatRangeSafe(value.from, value.to);
    return rangeStr || placeholder;
  }
  
  // Fallback
  return placeholder;
}
