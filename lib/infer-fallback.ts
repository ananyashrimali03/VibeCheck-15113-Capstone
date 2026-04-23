import type { InferenceResult, SignalsPacket } from "@/lib/types";
import { localTimePeriodFromHour } from "@/lib/signals";

/** Resolve bucket when older clients omit local_time_period */
export function resolveLocalTimePeriod(s: SignalsPacket): string {
  if (s.local_time_period) return s.local_time_period;
  if (typeof s.local_hour_24 === "number") return localTimePeriodFromHour(s.local_hour_24);
  const m = /^(\d{1,2}):/.exec(s.local_time_24h ?? "");
  if (m) return localTimePeriodFromHour(parseInt(m[1], 10));
  return "evening";
}

function weatherMetaphor(s: SignalsPacket): string {
  const w = s.weather;
  if (!w) return "air carrying the hour without hurry";
  const c = w.condition.toLowerCase();
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower"))
    return "rain tracing quiet lines on the glass";
  if (c.includes("clear")) return "last light holding steady before dark";
  if (c.includes("cloud") || c.includes("overcast")) return "soft sky, edges easing";
  if (c.includes("snow")) return "cold air sharp and still";
  if (c.includes("thunder") || c.includes("storm")) return "distant pressure in the sky";
  if (c.includes("fog")) return "soft edges where the world thins";
  return `${w.condition} brushing the moment`;
}

function weatherSummary(s: SignalsPacket): string {
  if (!s.weather) return "weather not included (enable location for live conditions)";
  const { condition, temp_c, wind_mps } = s.weather;
  return `${condition}, ${temp_c}°C, wind ~${wind_mps.toFixed(1)} m/s`;
}

/**
 * When Gemini is unavailable, still reflect the user's real local_time_24h, local_time_period,
 * timezone, and weather — never a static "afternoon" vignette at 6:35 PM.
 */
export function buildFallbackInference(signals: SignalsPacket): InferenceResult {
  const period = resolveLocalTimePeriod(signals);
  const clock = signals.local_time_24h ?? "?";
  const tz = signals.timezone ?? "local";
  const wMeta = weatherMetaphor(signals);
  const wRead = weatherSummary(signals);

  const baseSignalsLine = `Device clock ${clock} (${tz}), bucket "${period}". ${wRead}.`;

  if (period === "morning") {
    return {
      mood_label: "soft launch",
      confidence: 0.66,
      weather_metaphor: wMeta,
      notification_line: "Morning light—small starts before the noise catches up.",
      signals_used_for_read: `${baseSignalsLine} Morning energy: lift without hustle.`,
      deezer_query_why:
        "Feel-good chart pop brings brightness without study or ambient-only retrieval.",
      moment_arc: "Gentle headline, sensory weather, nudge stays bodily and small.",
      deezer_search_query: "feel good pop hits morning radio",
      playlist_title: "Steam & Sun / Soft Launch",
      playlist_vibe:
        "Permission to warm up slowly—familiar voices, nothing that demands a spreadsheet.",
      creative_nudge: "Fill a glass of water before the next scroll; notice the temperature.",
      affirmation_line: "Starting messy still counts as starting.",
      safety: { distress_hint: false, note: "" },
    };
  }

  if (period === "afternoon") {
    return {
      mood_label: "sunlit ease",
      confidence: 0.68,
      weather_metaphor: wMeta,
      notification_line: "Midday breathing room—bright light, low urgency.",
      signals_used_for_read: `${baseSignalsLine} Afternoon reads open and unhurried.`,
      deezer_query_why:
        "Bright mainstream pop fits a loose afternoon without lofi-only results.",
      moment_arc: "Easy pace in the line; metaphor stays sensory; nudge is one small pause.",
      deezer_search_query: "2010s summer pop radio hits",
      playlist_title: "Daylight / Easy Swing",
      playlist_vibe:
        "Porch-hum energy—nothing that needs focus mode; music as oxygen, not agenda.",
      creative_nudge: "Look out a window for ten seconds; name one color that isn’t gray.",
      affirmation_line: "You’re allowed to enjoy a slow hour.",
      safety: { distress_hint: false, note: "" },
    };
  }

  if (period === "evening") {
    return {
      mood_label: "golden fade",
      confidence: 0.7,
      weather_metaphor: wMeta,
      notification_line: "Evening settling in—light softening, the day loosening its grip.",
      signals_used_for_read: `${baseSignalsLine} Evening: wind-down, not midday rush—match language to dusk.`,
      deezer_query_why:
        "Radio-friendly pop and soft hits fit unwinding after work without spa or study keywords.",
      moment_arc: "Headline names the turn of day; weather grounds it; nudge is small and real.",
      deezer_search_query: "2010s pop ballads radio hits chart",
      playlist_title: "Last Light / Easy Unwind",
      playlist_vibe:
        "Familiar voices turned down a notch—soundtrack for closing tabs and opening the window.",
      creative_nudge:
        "Step outside for twenty seconds without your phone; notice one sound that isn’t traffic.",
      affirmation_line: "Rest can look like doing nothing on purpose.",
      safety: { distress_hint: false, note: "" },
    };
  }

  /* night */
  return {
    mood_label: "quiet drift",
    confidence: 0.67,
    weather_metaphor: wMeta,
    notification_line: "Night weight—headphones on, world turned a notch lower.",
    signals_used_for_read: `${baseSignalsLine} Night: inward, contained energy.`,
    deezer_query_why:
      "Softer chart hits and ballads carry late hours without ambient-bed retrieval.",
    moment_arc: "Small headline; cool metaphor; nudge stays private and doable.",
    deezer_search_query: "slow pop ballads hits 2020s",
    playlist_title: "Glasslines / Late Hours",
    playlist_vibe:
      "Close the loud tabs—familiar voices, low volume, no concentration-playlist bait.",
    creative_nudge: "Dim one lamp you don’t need; notice how the room changes.",
    affirmation_line: "Small resets still move the needle.",
    safety: { distress_hint: false, note: "" },
  };
}
