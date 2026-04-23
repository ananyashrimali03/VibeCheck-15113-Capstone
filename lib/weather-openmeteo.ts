import type { SignalsPacket } from "./types";

/** WMO Weather interpretation codes (Open-Meteo). */
function weatherCodeToCondition(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "partly cloudy";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  if (code <= 99) return "thunderstorm";
  return "variable";
}

export async function fetchOpenMeteoCurrent(
  lat: number,
  lon: number
): Promise<NonNullable<SignalsPacket["weather"]> | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=ms`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
    };

    const cur = data.current;
    if (!cur || typeof cur.temperature_2m !== "number") return null;

    const code = typeof cur.weather_code === "number" ? cur.weather_code : 0;
    return {
      condition: weatherCodeToCondition(code),
      temp_c: Math.round(cur.temperature_2m * 10) / 10,
      wind_mps: typeof cur.wind_speed_10m === "number" ? cur.wind_speed_10m : 0,
      weather_code: code,
    };
  } catch {
    return null;
  }
}
