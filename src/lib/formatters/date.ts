/**
 * Date Formatters
 * Deterministic date formatting for SSR + client hydration
 * 
 * CRITICAL: These formatters MUST produce identical output on server (Node.js) and client (browser)
 * to avoid React hydration mismatches.
 */

/**
 * Format date as short Russian day + month (e.g., "4 мар.")
 * 
 * This formatter is deterministic across Node.js and browser environments.
 * It uses Intl.DateTimeFormat with explicit locale and options, then normalizes
 * the output to ensure consistency.
 * 
 * Examples:
 * - new Date("2024-03-04") → "4 мар."
 * - new Date("2024-12-25") → "25 дек."
 * 
 * @param date - Date object or ISO string
 * @returns Formatted string like "4 мар." or empty string if invalid
 */
export function formatRuShortDayMonth(date: Date | string): string {
  try {
    // Parse string to Date if needed
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    // Check for invalid date
    if (isNaN(dateObj.getTime())) {
      return "";
    }

    // Use Intl.DateTimeFormat with explicit locale and options
    // This is more consistent across runtimes than toLocaleDateString()
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
    });

    let formatted = formatter.format(dateObj);

    // Normalize output:
    // 1. Ensure month abbreviation has trailing dot
    //    Some runtimes may output "мар" instead of "мар."
    // 2. Collapse multiple spaces
    // 3. Trim whitespace

    // Split into parts (day and month)
    const parts = formatted.split(/\s+/).filter(Boolean);
    
    if (parts.length >= 2) {
      const day = parts[0];
      let month = parts[1];
      
      // Ensure month has trailing dot if it doesn't already
      if (!month.endsWith(".")) {
        month = month + ".";
      }
      
      // Reconstruct with single space
      formatted = `${day} ${month}`;
    }

    return formatted.trim();
  } catch (error) {
    // Gracefully handle any errors
    console.error("formatRuShortDayMonth error:", error);
    return "";
  }
}

/**
 * Dev-only validation helper
 * Ensures formatter produces expected output
 */
if (process.env.NODE_ENV === "development") {
  // Self-test on module load
  const testDate = new Date("2024-03-04T12:00:00Z");
  const result = formatRuShortDayMonth(testDate);
  
  // Expected format: "4 мар."
  if (!result.match(/^\d{1,2}\s[а-я]{3}\.$/)) {
    console.warn(
      `[formatRuShortDayMonth] Unexpected format: "${result}". Expected pattern: "4 мар."`
    );
  }
  
  // Check for common issues
  if (result.includes("  ")) {
    console.warn(`[formatRuShortDayMonth] Double space detected: "${result}"`);
  }
  
  if (result.includes("марта") || result.includes("января")) {
    console.warn(
      `[formatRuShortDayMonth] Long month form detected: "${result}". Should use short form with dot.`
    );
  }
}
