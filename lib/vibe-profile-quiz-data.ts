/** Static copy for the vibe quiz — ids are stable for localStorage */

export const MBTI_OPTIONS = [
  { id: "INTJ", label: "INTJ — Architect" },
  { id: "INTP", label: "INTP — Thinker" },
  { id: "ENTJ", label: "ENTJ — Commander" },
  { id: "ENTP", label: "ENTP — Debater" },
  { id: "INFJ", label: "INFJ — Advocate" },
  { id: "INFP", label: "INFP — Mediator" },
  { id: "ENFJ", label: "ENFJ — Protagonist" },
  { id: "ENFP", label: "ENFP — Campaigner" },
  { id: "ISTJ", label: "ISTJ — Logistician" },
  { id: "ISFJ", label: "ISFJ — Defender" },
  { id: "ESTJ", label: "ESTJ — Executive" },
  { id: "ESFJ", label: "ESFJ — Consul" },
  { id: "ISTP", label: "ISTP — Virtuoso" },
  { id: "ISFP", label: "ISFP — Adventurer" },
  { id: "ESTP", label: "ESTP — Entrepreneur" },
  { id: "ESFP", label: "ESFP — Entertainer" },
  { id: "skip", label: "Prefer not to say" },
] as const;

export const ZODIAC_OPTIONS = [
  { id: "aries", label: "Aries" },
  { id: "taurus", label: "Taurus" },
  { id: "gemini", label: "Gemini" },
  { id: "cancer", label: "Cancer" },
  { id: "leo", label: "Leo" },
  { id: "virgo", label: "Virgo" },
  { id: "libra", label: "Libra" },
  { id: "scorpio", label: "Scorpio" },
  { id: "sagittarius", label: "Sagittarius" },
  { id: "capricorn", label: "Capricorn" },
  { id: "aquarius", label: "Aquarius" },
  { id: "pisces", label: "Pisces" },
  { id: "skip", label: "Prefer not to say" },
] as const;

export type ThisOrThatRow = {
  id: string;
  a: string;
  b: string;
};

export const THIS_OR_THAT: readonly ThisOrThatRow[] = [
  { id: "tot_social", a: "Crowded party energy", b: "Quiet night in" },
  { id: "tot_sound", a: "Lyrics & storytelling first", b: "Beat & groove first" },
  { id: "tot_time", a: "Golden hour / daytime", b: "Midnight city" },
  { id: "tot_plan", a: "Plan the playlist", b: "Surprise me" },
  { id: "tot_space", a: "Coffee shop corner", b: "Dance floor lights" },
  { id: "tot_weather", a: "Rain on the window", b: "Sun on the sidewalk" },
] as const;

export type McqOption = { id: string; label: string };

export type McqRow = {
  id: string;
  question: string;
  options: readonly McqOption[];
};

export const MCQS: readonly McqRow[] = [
  {
    id: "mcq_boost",
    question: "When you need a boost, you usually reach for…",
    options: [
      { id: "anthem", label: "A huge singalong anthem" },
      { id: "chill", label: "Something calm but hopeful" },
      { id: "nostalgic", label: "A throwback that hits deep" },
      { id: "new", label: "Something brand-new and surprising" },
    ],
  },
  {
    id: "mcq_weekend",
    question: "Your ideal weekend soundtrack leans…",
    options: [
      { id: "indie", label: "Indie / alt deep cuts" },
      { id: "chart", label: "Big chart hits everyone knows" },
      { id: "classic", label: "Classics & legacy artists" },
      { id: "mix", label: "A messy genre blend — surprise me" },
    ],
  },
  {
    id: "mcq_energy",
    question: "Pick the energy that usually fits you best…",
    options: [
      { id: "soft", label: "Soft & intimate" },
      { id: "bright", label: "Bright & bubbly" },
      { id: "bold", label: "Bold & loud" },
      { id: "moody", label: "Moody & cinematic" },
    ],
  },
  {
    id: "mcq_discover",
    question: "How do you like to find music?",
    options: [
      { id: "rabbit", label: "Rabbit holes & recommendations" },
      { id: "radio", label: "Radio / playlists / charts" },
      { id: "live", label: "Live shows & crowd energy" },
      { id: "friends", label: "Friends & word of mouth" },
    ],
  },
  {
    id: "mcq_lyrics",
    question: "Lyrics matter to you…",
    options: [
      { id: "everything", label: "They’re everything — I memorize lines" },
      { id: "sometimes", label: "Sometimes — depends on the day" },
      { id: "vibe", label: "Mostly as texture — vibe over poetry" },
      { id: "instrumental", label: "I often prefer hooks & production" },
    ],
  },
  {
    id: "mcq_tempo",
    question: "Your default walking pace as a song would be…",
    options: [
      { id: "slow", label: "Slow burn — room to breathe" },
      { id: "mid", label: "Mid-tempo drive" },
      { id: "fast", label: "Fast — keep it moving" },
      { id: "stop", label: "Stop-start — unpredictability" },
    ],
  },
] as const;

/** Multi-select chips for “About you” — ids stored on the profile */
export const ABOUT_KEYWORDS = [
  { id: "pop", label: "Pop" },
  { id: "rock", label: "Rock" },
  { id: "hiphop", label: "Hip-hop" },
  { id: "rnb", label: "R&B" },
  { id: "electronic", label: "Electronic / dance" },
  { id: "indie", label: "Indie / alt" },
  { id: "folk", label: "Folk / singer-songwriter" },
  { id: "jazz", label: "Jazz" },
  { id: "classical", label: "Classical" },
  { id: "country", label: "Country" },
  { id: "latin", label: "Latin" },
  { id: "metal", label: "Metal" },
  { id: "soul", label: "Soul / funk" },
  { id: "lyrics_first", label: "Lyrics-first" },
  { id: "beats_first", label: "Beats & production-first" },
  { id: "live_energy", label: "Live-show energy" },
  { id: "headphones", label: "Headphone deep cuts" },
  { id: "party", label: "Party / singalong" },
  { id: "chill", label: "Chill / unwind" },
  { id: "hype", label: "Hype / workout" },
  { id: "nostalgia", label: "Nostalgia" },
  { id: "discovery", label: "Always discovering new stuff" },
  { id: "throwbacks", label: "Throwbacks & classics" },
  { id: "rainy_day", label: "Rainy-day moods" },
  { id: "golden_hour", label: "Golden hour / sunny" },
  { id: "night_drive", label: "Night drives" },
  { id: "introspective", label: "Introspective" },
  { id: "mainstream_hits", label: "Big chart hits" },
  { id: "underground", label: "Underground / niche" },
  { id: "global", label: "Global sounds" },
] as const;

export function labelForAboutKeyword(id: string): string | undefined {
  return ABOUT_KEYWORDS.find((k) => k.id === id)?.label;
}
