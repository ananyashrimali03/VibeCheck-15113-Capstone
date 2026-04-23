import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SignalsPacket, InferenceResult } from "@/lib/types";
import { buildFallbackInference } from "@/lib/infer-fallback";

const GEMINI_MODEL = "gemini-flash-latest";

const SYSTEM_PROMPT = `You are VibeCheck, a mood-reading system that recommends music based on passive signals about a user's current moment. You receive a JSON signals packet and must return a single JSON object describing the user's mood and a music recommendation. No markdown, no explanation — only raw JSON.

Return exactly this shape:
{
  "mood_label": "two-word mood phrase, lowercase (e.g. 'quiet focus', 'sunlit ease')",
  "confidence": 0.0 to 1.0,
  "weather_metaphor": "short sensory image, 3-6 words, no full stop",
  "notification_line": "poetic headline, 8-14 words, captures the moment",
  "signals_used_for_read": "one sentence explaining which signals shaped the read",
  "deezer_query_why": "one sentence explaining why the search keywords fit the mood",
  "moment_arc": "one sentence on how headline + metaphor + nudge form a coherent moment",
  "deezer_search_query": "3-7 keywords for iTunes search — see rules below",
  "playlist_title": "Title / Subtitle format, evocative",
  "playlist_vibe": "2-3 sentences describing the feeling of the playlist, not genre labels",
  "creative_nudge": "one small, specific, physical action the user can take right now",
  "affirmation_line": "one brief affirming sentence",
  "safety": { "distress_hint": false, "note": "" }
}

Music search rules for "deezer_search_query" (still maps to the vibe above — only the retrieval style changes):
- Aim for recognizable hit songs by famous mainstream artists (major-label pop, rock, hip-hop, dance, alt).
  Prefer queries that combine a real artist name and/or a well-known song title that fits the mood.
  For iTunes variety: favor genre + era + vibe + "hits" / "radio" style queries (e.g. "2010s summer pop radio hits", "arena rock anthems 2000s") so results mix multiple stars — avoid queries that are only one artist name, which often returns several tracks by the same person.
  Examples of good directions (not literal templates): upbeat daylight → sunny pop hits; night energy → arena rock or chart electronic; introspective → famous ballads or acoustic singles by household-name artists.
- Across separate reads of the user's signals, deliberately vary deezer_search_query wording (rotate decades 1990s–2020s, alternate lanes like pop vs rock vs r&b vs dance vs indie, alternate phrasing like hits/radio/anthems/essentials/best of) whenever the mood still fits — avoid emitting the exact same keyword string on every inference so the catalog can surface different artists and eras.
- Do NOT steer searches toward study music, focus/lofi playlists, ambient beds, meditation, royalty-free, or generic instrumental background unless distress handling explicitly warrants something very gentle — and even then prefer a famous tender ballad over spa/ambient keywords.
- Avoid words like: study, lofi, ambient, instrumental (unless naming a specific famous song), focus music, concentration, background, cafe sleep playlist.

If signals suggest emotional distress, set distress_hint to true and add a brief note. Keep tone warm, non-clinical, non-prescriptive.

Time and weather (read the signals literally):
- collected_at_iso is UTC for ordering/debugging only — do NOT use it to infer the user's local time of day (it will mislead you vs their real clock).
- For morning/afternoon/evening/night language, rely on local_time_24h, local_hour_24, local_time_period, timezone, and day_of_week. Treat local_time_period as the canonical bucket (e.g. 18:23 → evening, not afternoon).
- Hard rule for visible text: In mood_label, notification_line, and weather_metaphor, your time-of-day words MUST match local_time_period. If local_time_period is "evening", never use "afternoon", "midday", or "noon"; use evening/dusk/twilight/night-adjacent imagery. If "afternoon", do not say evening or morning for the clock. This overrides poetic habit and any vibe_profile wording.
- Current weather in object "weather" is from Open-Meteo at geo lat/lon when present; match metaphors to condition, temp_c, and wind. If weather is absent, note limitations in signals_used_for_read and do not invent conditions.

When the JSON includes "vibe_profile" (long-term taste & personality self-report from the same device):
- Treat it as the primary prior for what kinds of songs and energies this person likes — especially for deezer_search_query, playlist_vibe, and playlist_title.
- Blend it with live signals (local time, weekday, weather, battery/idle, listening history): the moment still matters, but the profile should steer genre lean, era bias, social vs introspective edge, and lyrical vs production-first taste.
- Mention in signals_used_for_read how live context and profile combined (one sentence).
- If vibe_profile is missing or empty, rely on live signals only (same as before).
- vibe_profile must not override local_time_period for clock/circadian wording — profile is taste; local_time_period is the actual local clock bucket.`;

function buildPrompt(signals: SignalsPacket): string {
  const summary = signals.vibe_profile?.summary_for_model;
  const profileHint = summary
    ? `\n\nVibe profile summary (weight heavily for recommendations):\n${summary}\n`
    : "";
  const period = signals.local_time_period ?? "unknown";
  const clock = signals.local_time_24h ?? "?";
  const circadian = `REQUIRED alignment: local_time_period is "${period}" at local clock ${clock} (${signals.timezone}). All mood_label, notification_line, and weather_metaphor wording for time-of-day MUST fit "${period}" — if period is evening, do not write "afternoon" or "midday".`;

  return `Here are the user's current signals (JSON). The packet may include "vibe_profile" with name, about, MBTI/zodiac self-reports, and quiz answers.\n\n${circadian}\n\n${JSON.stringify(signals, null, 2)}${profileHint}\n\nRead the mood and return the JSON object. For deezer_search_query, use keywords that will surface chart-level artists and famous songs on iTunes (no study/ambient/background-style queries), tuned to BOTH the live moment and the long-term vibe profile when present.`;
}

function parseSafeJson(text: string): InferenceResult | null {
  // Strip possible markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned) as InferenceResult;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let signals: SignalsPacket;
  try {
    signals = (await req.json()) as SignalsPacket;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      ...buildFallbackInference(signals),
      _source: "fallback_no_key",
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: buildPrompt(signals) },
    ]);

    const raw = result.response.text();
    const parsed = parseSafeJson(raw);

    if (!parsed) {
      return NextResponse.json({
        ...buildFallbackInference(signals),
        _source: "fallback_parse_error",
      });
    }

    return NextResponse.json({ ...parsed, _source: "gemini" });
  } catch (err) {
    console.error("[/api/infer] Gemini error:", err);
    return NextResponse.json({
      ...buildFallbackInference(signals),
      _source: "fallback_api_error",
    });
  }
}
