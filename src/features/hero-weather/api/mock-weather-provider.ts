import type { WeatherProvider } from "./weather-provider";
import type { WeatherRawData, WeatherHourSlot } from "../model/types";

type MockScenario = "sunny" | "rainy" | "cold_windy";

function makeHourly(base: Partial<WeatherHourSlot>, count = 24): WeatherHourSlot[] {
  return Array.from({ length: count }, () => ({
    temperature: base.temperature ?? null,
    apparentTemperature: base.apparentTemperature ?? null,
    weatherCode: base.weatherCode ?? null,
    windSpeed: base.windSpeed ?? null,
    windGusts: base.windGusts ?? null,
    precipitation: base.precipitation ?? null,
    precipitationProbability: base.precipitationProbability ?? null,
    isDay: base.isDay ?? true,
  }));
}

const MOCK_DATA: Record<MockScenario, WeatherRawData> = {
  sunny: {
    current: {
      temperature: 22,
      apparentTemperature: 21,
      weatherCode: 1, // mainly clear
      windSpeed: 5,
      windGusts: 8,
      precipitation: 0,
      precipitationProbability: 5,
      isDay: true,
    },
    hourly: makeHourly({
      temperature: 23,
      apparentTemperature: 22,
      weatherCode: 1,
      windSpeed: 5,
      windGusts: 8,
      precipitation: 0,
      precipitationProbability: 5,
      isDay: true,
    }),
  },

  rainy: {
    current: {
      temperature: 14,
      apparentTemperature: 12,
      weatherCode: 61, // slight rain
      windSpeed: 10,
      windGusts: 14,
      precipitation: 0.4,
      precipitationProbability: 75,
      isDay: true,
    },
    hourly: makeHourly({
      temperature: 13,
      apparentTemperature: 11,
      weatherCode: 63, // moderate rain
      windSpeed: 12,
      windGusts: 16,
      precipitation: 1.2,
      precipitationProbability: 85,
      isDay: true,
    }),
  },

  cold_windy: {
    current: {
      temperature: 2,
      apparentTemperature: -4,
      weatherCode: 3, // overcast
      windSpeed: 18,
      windGusts: 22,
      precipitation: 0,
      precipitationProbability: 20,
      isDay: true,
    },
    hourly: makeHourly({
      temperature: 1,
      apparentTemperature: -5,
      weatherCode: 3,
      windSpeed: 20,
      windGusts: 25,
      precipitation: 0,
      precipitationProbability: 15,
      isDay: true,
    }),
    warnings: [{ type: "wind", severity: "moderate" }],
  },
};

export class MockWeatherProvider implements WeatherProvider {
  constructor(private readonly scenario: MockScenario = "sunny") {}

  async fetchWeather(_params: {
    latitude: number;
    longitude: number;
    timezone?: string;
  }): Promise<WeatherRawData | null> {
    // Simulate async fetch
    await new Promise((r) => setTimeout(r, 0));
    return MOCK_DATA[this.scenario];
  }
}
