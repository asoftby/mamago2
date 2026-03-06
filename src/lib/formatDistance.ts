/**
 * Format distance in meters to human-readable string
 * 
 * @param meters - Distance in meters
 * @returns Formatted string (e.g., "850 м" or "1.4 км")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} м`;
  }

  const km = meters / 1000;
  return `${km.toFixed(1)} км`;
}
