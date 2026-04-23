import type { SignalsPacket } from "./types";
import { readStoredGeo } from "./geo-storage";
import { buildListeningContext, loadListeningHistory } from "./listening";
import { fetchOpenMeteoCurrent } from "./weather-openmeteo";

/** Bucket local hour for consistent “afternoon vs evening” language (local clock, not UTC). */
export function localTimePeriodFromHour(hour24: number): string {
  const h = Math.floor(hour24);
  if (h >= 22 || h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

export async function collectSignals(idleMs: number): Promise<SignalsPacket> {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const pad = (n: number) => String(n).padStart(2, "0");
  const local_hour_24 = now.getHours();
  const local_time_24h = `${pad(local_hour_24)}:${pad(now.getMinutes())}`;
  const local_time_period = localTimePeriodFromHour(local_hour_24);
  const day_of_week = now.toLocaleDateString("en-US", { weekday: "long" });

  let battery_percent: number | null = null;
  let charging: boolean | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batt = await (navigator as any).getBattery?.();
    if (batt) {
      battery_percent = Math.round(batt.level * 100);
      charging = batt.charging as boolean;
    }
  } catch {
    // Battery API not available — fine
  }

  const ua = navigator.userAgent.toLowerCase();
  const ua_mobile =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).userAgentData?.mobile ??
    /android|iphone|ipad|ipod|mobile/.test(ua);

  const rows = loadListeningHistory();
  const listening = buildListeningContext(rows);

  const limitations: string[] = ["no_streaming_oauth"];

  let geo: SignalsPacket["geo"];
  let weather: SignalsPacket["weather"];

  const stored = readStoredGeo();
  if (stored) {
    geo = {
      lat: stored.lat,
      lon: stored.lon,
      accuracy_m: stored.accuracy_m,
    };
    const w = await fetchOpenMeteoCurrent(stored.lat, stored.lon);
    if (w) {
      weather = w;
    } else {
      limitations.push("weather_unavailable");
    }
  } else {
    limitations.push("no_geolocation");
    limitations.push("no_weather");
  }

  return {
    collected_at_iso: now.toISOString(),
    timezone: tz,
    local_time_24h,
    local_hour_24,
    local_time_period,
    day_of_week,
    locale: navigator.language,
    geo,
    weather,
    device: {
      battery_percent,
      charging,
      online: navigator.onLine,
      ua_mobile,
    },
    behavior: {
      visibility: document.visibilityState,
      idle_ms_estimate: idleMs,
    },
    listening: listening ?? undefined,
    limitations,
  };
}
