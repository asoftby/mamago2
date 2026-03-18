/**
 * Derives the most likely city for a route based on its stops.
 * Uses a simple majority-vote approach on city strings extracted from addresses.
 */

export type StopForCityDerivation = {
  source: "GOOGLE" | "PLACE" | "MANUAL_PIN";
  address?: string;
  cityName?: string; // explicit city if known (e.g. from Place entity)
};

/**
 * Extracts a city hint from a free-text address string.
 * Very lightweight — looks for known Belarusian cities in the address.
 */
const KNOWN_CITIES = ["Минск", "Брест", "Гродно", "Гомель", "Витебск", "Могилёв", "Могилев", "Бобруйск", "Барановичи", "Борисов", "Пинск"];

function extractCityFromAddress(address: string): string | null {
  for (const city of KNOWN_CITIES) {
    if (address.toLowerCase().includes(city.toLowerCase())) return city;
  }
  return null;
}

/**
 * Returns the dominant city name from a list of stops, or null if undetermined.
 */
export function deriveRouteCityFromStops(stops: StopForCityDerivation[]): string | null {
  const votes: Record<string, number> = {};

  for (const stop of stops) {
    // Explicit city from Place entity takes priority
    const city = stop.cityName ?? (stop.address ? extractCityFromAddress(stop.address) : null);
    if (city) {
      votes[city] = (votes[city] ?? 0) + 1;
    }
  }

  const entries = Object.entries(votes);
  if (entries.length === 0) return null;

  // Return the city with the most votes
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}
