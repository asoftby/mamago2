/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Deep equality comparison for objects
 * Used to avoid unnecessary saves when data hasn't actually changed
 */

export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return a === b;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

/**
 * Normalize place data for comparison
 * Removes undefined values and normalizes empty strings to null
 */
export function normalizePlaceData(data: any): any {
  if (data == null) return data;
  
  if (typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(normalizePlaceData);
  }
  
  const normalized: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    
    if (value === '') {
      normalized[key] = null;
    } else if (typeof value === 'object') {
      normalized[key] = normalizePlaceData(value);
    } else {
      normalized[key] = value;
    }
  }
  
  return normalized;
}

/**
 * Check if place data has actually changed compared to last saved state
 */
export function hasPlaceDataChanged(
  currentData: any, 
  lastSavedData: any
): boolean {
  const normalizedCurrent = normalizePlaceData(currentData);
  const normalizedLast = normalizePlaceData(lastSavedData);
  
  return !deepEqual(normalizedCurrent, normalizedLast);
}