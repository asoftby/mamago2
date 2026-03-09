/**
 * Diff utilities for content moderation
 * Compares current and new versions of content to highlight changes
 */

import { formatAgeKeys } from "@/lib/config/ages";

export type ChangeType = "added" | "removed" | "changed" | "unchanged";

export interface FieldChange<T = any> {
  field: string;
  label: string;
  oldValue: T;
  newValue: T;
  changeType: ChangeType;
  isEmpty: boolean; // true if both values are empty
}

export interface ImageChange {
  id: string;
  url: string;
  kind: string;
  changeType: "added" | "removed" | "unchanged";
  sortOrder?: number;
}

export interface DiffSummary {
  changedFields: number;
  addedPhotos: number;
  removedPhotos: number;
  unchangedPhotos: number;
  totalChanges: number;
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array)
 */
function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Compare two values and determine change type
 */
function getChangeType(oldValue: any, newValue: any): ChangeType {
  const oldEmpty = isEmpty(oldValue);
  const newEmpty = isEmpty(newValue);

  if (oldEmpty && newEmpty) return "unchanged";
  if (oldEmpty && !newEmpty) return "added";
  if (!oldEmpty && newEmpty) return "removed";

  // Both have values - check if they're different
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    // Compare arrays
    if (oldValue.length !== newValue.length) return "changed";
    const sorted1 = [...oldValue].sort();
    const sorted2 = [...newValue].sort();
    return JSON.stringify(sorted1) === JSON.stringify(sorted2) ? "unchanged" : "changed";
  }

  // Compare primitives
  return oldValue === newValue ? "unchanged" : "changed";
}

/**
 * Compare two objects and return field changes
 */
export function compareFields<T extends Record<string, any>>(
  oldData: T,
  newData: T,
  fieldConfig: Array<{ field: keyof T; label: string }>
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const { field, label } of fieldConfig) {
    const oldValue = oldData[field];
    const newValue = newData[field];
    const changeType = getChangeType(oldValue, newValue);
    const isFieldEmpty = isEmpty(oldValue) && isEmpty(newValue);

    changes.push({
      field: field as string,
      label,
      oldValue,
      newValue,
      changeType,
      isEmpty: isFieldEmpty,
    });
  }

  return changes;
}

/**
 * Filter to only changed fields
 */
export function getChangedFields(changes: FieldChange[]): FieldChange[] {
  return changes.filter(
    (change) => change.changeType !== "unchanged" && !change.isEmpty
  );
}

/**
 * Compare images between current and new version
 * Images are sorted by sortOrder to maintain stable numbering
 */
export function compareImages(
  oldImages: Array<{ id: string; url: string; kind: string; sortOrder?: number }>,
  newImages: Array<{ id: string; url: string; kind: string; sortOrder?: number }>
): {
  changes: ImageChange[];
  added: ImageChange[];
  removed: ImageChange[];
  unchanged: ImageChange[];
} {
  // Sort images by sortOrder for stable numbering
  const sortedOldImages = [...oldImages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const sortedNewImages = [...newImages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const changes: ImageChange[] = [];
  const added: ImageChange[] = [];
  const removed: ImageChange[] = [];
  const unchanged: ImageChange[] = [];

  // Create maps for quick lookup
  const oldMap = new Map(sortedOldImages.map((img) => [img.url, img]));
  const newMap = new Map(sortedNewImages.map((img) => [img.url, img]));

  // Find added and unchanged images
  for (const newImg of sortedNewImages) {
    if (oldMap.has(newImg.url)) {
      const change: ImageChange = {
        id: newImg.id,
        url: newImg.url,
        kind: newImg.kind,
        changeType: "unchanged",
        sortOrder: newImg.sortOrder,
      };
      unchanged.push(change);
      changes.push(change);
    } else {
      const change: ImageChange = {
        id: newImg.id,
        url: newImg.url,
        kind: newImg.kind,
        changeType: "added",
        sortOrder: newImg.sortOrder,
      };
      added.push(change);
      changes.push(change);
    }
  }

  // Find removed images
  for (const oldImg of sortedOldImages) {
    if (!newMap.has(oldImg.url)) {
      const change: ImageChange = {
        id: oldImg.id,
        url: oldImg.url,
        kind: oldImg.kind,
        changeType: "removed",
        sortOrder: oldImg.sortOrder,
      };
      removed.push(change);
      changes.push(change);
    }
  }

  return { changes, added, removed, unchanged };
}

/**
 * Generate diff summary
 */
export function generateDiffSummary(
  fieldChanges: FieldChange[],
  imageChanges: ReturnType<typeof compareImages>
): DiffSummary {
  const changedFields = fieldChanges.filter(
    (c) => c.changeType !== "unchanged" && !c.isEmpty
  ).length;

  return {
    changedFields,
    addedPhotos: imageChanges.added.length,
    removedPhotos: imageChanges.removed.length,
    unchangedPhotos: imageChanges.unchanged.length,
    totalChanges: changedFields + imageChanges.added.length + imageChanges.removed.length,
  };
}

/**
 * Format value for display
 * @param value - The value to format
 * @param field - Optional field name for special formatting (e.g., "ageTags")
 */
export function formatValue(value: any, field?: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    
    // Special formatting for age tags
    if (field === "ageTags") {
      return formatAgeKeys(value);
    }
    
    return value.join(", ");
  }
  return String(value);
}
