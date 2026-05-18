/**
 * Derives the most likely city for a route based on its stops.
 * Uses a simple majority-vote approach on city + country strings extracted from addresses.
 * Works worldwide — no hardcoded city list.
 */

export type StopForCityDerivation = {
  source: "GOOGLE" | "PLACE" | "MANUAL_PIN";
  address?: string;
  cityName?: string; // explicit city if known (e.g. from Place entity)
  detectedCityName?: string;
  detectedCountryCode?: string;
  detectedCountryName?: string;
};

/**
 * Returns the dominant city+country label from a list of stops, or null if undetermined.
 * Format: "City, Country" or just "City" if country is unknown.
 */
export function deriveRouteCityFromStops(stops: StopForCityDerivation[]): string | null {
  const votes: Record<string, number> = {};

  for (const stop of stops) {
    // Prefer explicit city from Place entity or detected fields
    const city = stop.cityName ?? stop.detectedCityName ?? null;
    if (city) {
      const label = stop.detectedCountryCode
        ? `${city}, ${stop.detectedCountryCode}`
        : city;
      votes[label] = (votes[label] ?? 0) + 1;
    }
  }

  const entries = Object.entries(votes);
  if (entries.length === 0) return null;

  // Return the city+country with the most votes
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}
