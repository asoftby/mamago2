/**
 * Formats a base label with a count.
 * @param base - e.g. "Возраст"
 * @param count - e.g. 3
 * @returns "Возраст: 3"
 */
export function formatCountLabel(base: string, count: number): string {
  if (count <= 0) return base;
  return `${base}: ${count}`;
}

/**
 * Splits a composite label (e.g. "Возраст: 3–5") into label and value parts.
 * If no colon found, returns label as input and undefined value.
 * @param inputLabel - e.g. "Возраст: 3–5" or "Возраст"
 */
export function splitLabelValue(inputLabel: string): { label: string; valueText?: string } {
  if (!inputLabel) return { label: "" };
  
  const separatorIndex = inputLabel.indexOf(':');
  if (separatorIndex === -1) {
    return { label: inputLabel };
  }

  const label = inputLabel.substring(0, separatorIndex).trim();
  const valueText = inputLabel.substring(separatorIndex + 1).trim();

  return { label, valueText };
}
