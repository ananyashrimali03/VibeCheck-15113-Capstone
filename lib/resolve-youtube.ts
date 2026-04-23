/**
 * Resolve YouTube video IDs and optional full-length audio streams via Piped API,
 * with optional YouTube Data API v3 when YOUTUBE_API_KEY is set.
 */

const SEARCH_TIMEOUT_MS = 14_000;
const STREAMS_TIMEOUT_MS = 16_000;

function getPipedApiBases(): string[] {
  const raw = process.env.PIPED_API_BASES?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);
  }
  // Public API hosts (rotate if one is down); override with PIPED_API_BASES in production.
  return [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.in.projectsegfau.lt",
    "https://pipedapi.r4fo.com",
    "https://pipedapi.syncpundit.io",
  ];
}

export function extractYoutubeIdFromUrl(url: string | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const m = url.match(/(?:v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? null;
}

function normalizeSearchItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "items" in data && Array.isArray((data as { items: unknown[] }).items)) {
    return (data as { items: unknown[] }).items;
  }
  return [];
}

function firstVideoIdFromPipedItems(items: unknown[]): string | null {
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { url?: string };
    const id = extractYoutubeIdFromUrl(rec.url);
    if (id) return id;
  }
  return null;
}

async function pipedSearchVideoId(apiBase: string, query: string): Promise<string | null> {
  const base = apiBase.replace(/\/$/, "");
  for (const filter of ["videos", "all"] as const) {
    const url = `${base}/search?q=${encodeURIComponent(query)}&filter=${filter}`;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const data: unknown = await res.json();
      const items = normalizeSearchItems(data);
      const id = firstVideoIdFromPipedItems(items);
      if (id) return id;
    } catch {
      continue;
    }
  }
  return null;
}

async function youtubeDataApiSearch(query: string, apiKey: string): Promise<string | null> {
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=id&maxResults=1&type=video` +
    `&q=${encodeURIComponent(`${query} official audio`)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: Array<{ id?: { videoId?: string } }> };
  return data.items?.[0]?.id?.videoId ?? null;
}

export type ResolvedPlayback = {
  youtube_video_id?: string;
  stream_audio_url?: string;
};

/**
 * Prefer a direct audio stream (full length in HTML audio). Fall back to video id for YouTube embed.
 */
export async function resolveFullPlayback(artist: string, title: string): Promise<ResolvedPlayback> {
  const query = `${artist} ${title}`.trim();
  if (!query) return {};

  let videoId: string | null = null;
  let pipedBaseUsed: string | null = null;

  const ytKey = process.env.YOUTUBE_API_KEY?.trim();
  if (ytKey) {
    videoId = await youtubeDataApiSearch(query, ytKey);
  }

  if (!videoId) {
    for (const base of getPipedApiBases()) {
      try {
        const id = await pipedSearchVideoId(base, `${query} official audio`);
        if (id) {
          videoId = id;
          pipedBaseUsed = base;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!videoId) return {};

  const basesForStreams = pipedBaseUsed
    ? [pipedBaseUsed, ...getPipedApiBases().filter((b) => b !== pipedBaseUsed)]
    : getPipedApiBases();

  for (const base of basesForStreams) {
    const audioUrl = await fetchPipedBestAudioUrl(base, videoId);
    if (audioUrl) {
      return { stream_audio_url: audioUrl };
    }
  }

  return { youtube_video_id: videoId };
}

async function fetchPipedBestAudioUrl(apiBase: string, videoId: string): Promise<string | null> {
  try {
    const base = apiBase.replace(/\/$/, "");
    const res = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(STREAMS_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      audioStreams?: Array<{ url?: string; bitrate?: number; mimeType?: string }>;
    };
    const streams = data.audioStreams?.filter((s) => s.url) ?? [];
    if (streams.length === 0) return null;

    const ranked = [...streams].sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
    const preferM4a =
      ranked.find((s) => s.mimeType?.includes("mp4") || s.mimeType?.includes("audio/mp4")) ?? ranked[0];
    return preferM4a?.url ?? null;
  } catch {
    return null;
  }
}
