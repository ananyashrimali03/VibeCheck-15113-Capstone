/** Wire formats for signals and inference — see project spec docs for detail */

export type ListeningPlayRow = {
  played_at_iso: string;
  title: string;
  artist_name: string;
  deezer_track_id?: number;
  genres?: string[];
  play_ratio?: number;
  source?: "local_app";
};

export type SignalsPacket = {
  collected_at_iso: string;
  timezone: string;
  local_time_24h: string;
  /** 0–23 from the same local clock as local_time_24h */
  local_hour_24: number;
  /**
   * Ground-truth label for time-of-day vocabulary (morning / afternoon / evening / night).
   * Derived from local_hour_24 — models must not infer local time from collected_at_iso (UTC).
   */
  local_time_period: string;
  day_of_week: string;
  locale: string;
  geo?: {
    lat: number;
    lon: number;
    accuracy_m?: number;
  };
  weather?: {
    condition: string;
    temp_c: number;
    wind_mps: number;
    weather_code?: number;
  };
  device: {
    battery_percent: number | null;
    charging: boolean | null;
    online: boolean;
    ua_mobile: boolean;
  };
  behavior: {
    visibility: string;
    idle_ms_estimate: number;
  };
  listening?: {
    source: string;
    recent_plays: ListeningPlayRow[];
    aggregate_hint?: { top_genres: string[]; notes: string };
  };
  limitations: string[];
  /**
   * Optional long-term vibe profile (local device quiz + name/about). When set, the model should
   * weight it heavily for music taste alongside live time/weather/context signals.
   */
  vibe_profile?: VibeProfilePacket;
};

/** Serializable profile sent with signals — built client-side from saved quiz + bio */
export type VibeProfilePacket = {
  display_name: string;
  about: string;
  mbti: string | null;
  zodiac: string | null;
  /** Human-readable lines like "Prefers lyrics-first over beat-first" */
  preference_notes: string[];
  /** Single paragraph for the LLM */
  summary_for_model: string;
  updated_at_iso: string;
};

/** Structured vibe card — from live Gemini inference or fallback scenes when offline */
export type InferenceResult = {
  mood_label: string;
  confidence: number;
  weather_metaphor: string;
  notification_line: string;
  /** Which passive signals mattered most and how they combined (non-clinical). */
  signals_used_for_read: string;
  /** Why these search keywords fit the playlist. */
  deezer_query_why: string;
  /** How hero line + metaphor + nudge form one coherent moment. */
  moment_arc: string;
  deezer_search_query: string;
  playlist_title: string;
  playlist_vibe: string;
  creative_nudge: string;
  affirmation_line: string;
  safety: { distress_hint: boolean; note?: string };
};

export type DeezerTrack = {
  id: number;
  title: string;
  preview: string;
  link: string;
  duration: number;
  artist: { name: string };
  album?: { cover_medium?: string; cover_small?: string };
  /** Direct audio URL (e.g. from Piped) — full song in the HTML audio player. */
  stream_audio_url?: string;
};
