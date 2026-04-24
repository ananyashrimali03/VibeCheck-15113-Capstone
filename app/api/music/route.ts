import { NextRequest, NextResponse } from "next/server";
import type { DeezerTrack } from "@/lib/types";
import { nextDemoScene } from "@/lib/demo-scenes";
import { resolveFullPlayback } from "@/lib/resolve-youtube";

export const dynamic = "force-dynamic";

const ITUNES_LIMIT = 200;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Deterministic RNG from a seed — different `vary` → different shuffle / tie-breaks. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFromVary(vary: string): () => number {
  const seed = hashString(vary) || 1;
  return mulberry32(seed);
}

function parseExcludeIds(param: string | null): Set<number> {
  if (!param?.trim()) return new Set();
  const ids = new Set<number>();
  for (const part of param.split(",")) {
    const n = Number.parseInt(part.trim(), 10);
    if (!Number.isNaN(n)) ids.add(n);
  }
  return ids;
}

function artistKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+feat\.[\s\S]*/i, "")
    .replace(/\s*&\s*/g, " ")
    .trim();
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Broad genre buckets so we prefer different sonic lanes when iTunes labels allow it. */
function genreBucket(primaryGenre?: string): string {
  if (!primaryGenre?.trim()) return "unknown";
  const g = primaryGenre.toLowerCase().trim();
  if (/pop|dance|electronic|edm|house|techno|hyperpop|uk garage/.test(g)) return "pop-electronic";
  if (/hip|hop|rap|r&b|soul|trap|drill|urban/.test(g)) return "hiphop-rnb";
  if (/rock|alternative|indie|metal|punk|grunge|hard rock/.test(g)) return "rock-alt";
  if (/country|folk|americana|bluegrass/.test(g)) return "country-folk";
  if (/jazz|blues|easy listening|swing/.test(g)) return "jazz-blues";
  if (/\bk-pop\b|kpop/i.test(g)) return "pop-electronic";
  if (/latin|reggae|brazilian|world|afrobeats/.test(g)) return "latin-global";
  if (/classical|soundtrack|original score|film score/.test(g)) return "classical-screen";
  if (/christian|gospel|inspirational/.test(g)) return "christian-gospel";
  return g.slice(0, 36);
}

function decadeBucket(releaseIso?: string): string {
  if (!releaseIso) return "unknown";
  const y = Number.parseInt(releaseIso.slice(0, 4), 10);
  if (!Number.isFinite(y) || y < 1900) return "unknown";
  return `${Math.floor(y / 10) * 10}s`;
}

function albumKey(collectionId?: number, collectionName?: string): string {
  if (collectionId != null && collectionId > 0) return `id:${collectionId}`;
  if (!collectionName?.trim()) return "unknown";
  return collectionName.toLowerCase().trim().slice(0, 48);
}

type TrackCandidate = {
  track: DeezerTrack;
  genreBucket: string;
  decade: string;
  albumKey: string;
};

/** Pick 3 tracks: distinct artists when possible; greedily maximize genre + era + album spread. */
function pickDiverseTracks(candidates: TrackCandidate[], rng: () => number): DeezerTrack[] {
  if (candidates.length === 0) return [];

  const pool = [...candidates];
  shuffleInPlace(pool, rng);

  const picked: TrackCandidate[] = [];
  const artistUsed = new Set<string>();
  const pickedTrackIds = new Set<number>();

  function diversityScore(c: TrackCandidate): number {
    if (picked.length === 0) return rng();
    let s = 0;
    for (const p of picked) {
      if (c.genreBucket !== p.genreBucket) s += 12;
      if (c.decade !== p.decade && c.decade !== "unknown" && p.decade !== "unknown") s += 8;
      if (c.albumKey !== p.albumKey && c.albumKey !== "unknown") s += 4;
      if (c.track.title !== p.track.title) s += 1;
    }
    return s + rng() * 24;
  }

  /** When onlyNewArtists is true, skip artists already chosen (preferred trio). */
  function pickBest(onlyNewArtists: boolean): TrackCandidate | undefined {
    let best: TrackCandidate | undefined;
    let bestScore = -Infinity;
    for (const c of pool) {
      if (pickedTrackIds.has(c.track.id)) continue;
      const ak = artistKey(c.track.artist.name);
      if (onlyNewArtists && artistUsed.has(ak)) continue;
      const sc = diversityScore(c);
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    return best;
  }

  const first = pickBest(false);
  if (!first) return [];
  picked.push(first);
  pickedTrackIds.add(first.track.id);
  artistUsed.add(artistKey(first.track.artist.name));

  while (picked.length < 3) {
    const next = pickBest(true);
    if (!next) break;
    picked.push(next);
    pickedTrackIds.add(next.track.id);
    artistUsed.add(artistKey(next.track.artist.name));
  }

  while (picked.length < 3) {
    const next = pickBest(false);
    if (!next) break;
    picked.push(next);
    pickedTrackIds.add(next.track.id);
    artistUsed.add(artistKey(next.track.artist.name));
  }

  return picked.slice(0, 3).map((p) => p.track);
}

function dedupeCandidatesByTrackId(candidates: TrackCandidate[]): TrackCandidate[] {
  const seen = new Set<number>();
  const out: TrackCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.track.id)) continue;
    seen.add(c.track.id);
    out.push(c);
  }
  return out;
}

interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  previewUrl?: string;
  trackViewUrl?: string;
  trackTimeMillis?: number;
  artworkUrl100?: string;
  artworkUrl60?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  collectionId?: number;
  collectionName?: string;
}

interface ItunesResponse {
  resultCount: number;
  results: ItunesTrack[];
}

function toTrack(t: ItunesTrack, i: number): DeezerTrack {
  return {
    id: t.trackId ?? i,
    title: t.trackName ?? "Unknown",
    preview: t.previewUrl ?? "",
    link: t.trackViewUrl ?? "https://music.apple.com",
    duration: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : 30,
    artist: { name: t.artistName ?? "Unknown" },
    album: {
      cover_medium: t.artworkUrl100,
      cover_small: t.artworkUrl60,
    },
  };
}

function toCandidate(t: ItunesTrack, i: number): TrackCandidate {
  return {
    track: toTrack(t, i),
    genreBucket: genreBucket(t.primaryGenreName),
    decade: decadeBucket(t.releaseDate),
    albumKey: albumKey(t.collectionId, t.collectionName),
  };
}

async function fetchItunesPreviewTracks(term: string): Promise<TrackCandidate[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${ITUNES_LIMIT}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`iTunes responded ${res.status}`);
  const data = (await res.json()) as ItunesResponse;
  return data.results.filter((t) => t.previewUrl).map((t, i) => toCandidate(t, i));
}

async function fetchItunesPreviewTracksSafe(term: string): Promise<TrackCandidate[]> {
  try {
    return await fetchItunesPreviewTracks(term);
  } catch {
    return [];
  }
}

/**
 * Merge several iTunes searches so we are not stuck to one ranking — broader, more flexible picks.
 */
async function expandCandidatePool(baseQuery: string, varyRaw: string | null): Promise<TrackCandidate[]> {
  const salt = varyRaw ? hashString(varyRaw) : Date.now();
  const flavor = ["hits", "radio", "chart", "playlist", "singles", "remaster", "live"];

  const wave1 = await Promise.all([
    fetchItunesPreviewTracksSafe(baseQuery),
    fetchItunesPreviewTracksSafe(`${baseQuery} ${flavor[salt % flavor.length]}`),
    fetchItunesPreviewTracksSafe(`${baseQuery} ${flavor[(salt + 2) % flavor.length]}`),
    fetchItunesPreviewTracksSafe(`${baseQuery} ${flavor[(salt + 4) % flavor.length]}`),
  ]);

  let candidates = dedupeCandidatesByTrackId(wave1.flat());

  const wave2 = await Promise.all([
    fetchItunesPreviewTracksSafe(`popular ${baseQuery}`),
    fetchItunesPreviewTracksSafe(`${baseQuery} greatest hits`),
    fetchItunesPreviewTracksSafe(`best songs ${baseQuery}`),
    fetchItunesPreviewTracksSafe(`${baseQuery} artists`),
  ]);

  candidates = dedupeCandidatesByTrackId([...candidates, ...wave2.flat()]);

  const wave3Terms = [
    `${baseQuery} soundtrack`,
    `${baseQuery} compilation`,
    `classic hits ${baseQuery}`,
  ];
  const w3 = await Promise.all(wave3Terms.map((t) => fetchItunesPreviewTracksSafe(t)));
  candidates = dedupeCandidatesByTrackId([...candidates, ...w3.flat()]);

  return candidates;
}

async function enrichFullPlayback(tracks: DeezerTrack[]): Promise<DeezerTrack[]> {
  const results = await Promise.all(
    tracks.map(async (t) => {
      const placeholder =
        /soundhelix/i.test(t.artist.name) || /soundhelix/i.test(t.title);
      if (placeholder || !t.preview) return t;

      try {
        const playback = await resolveFullPlayback(t.artist.name, t.title);
        if (playback.stream_audio_url) {
          return { ...t, stream_audio_url: playback.stream_audio_url };
        }
      } catch {
        /* keep iTunes preview only */
      }
      return t;
    })
  );

  return results;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "Missing query param ?q=" }, { status: 400 });
  }

  const excludeIds = parseExcludeIds(req.nextUrl.searchParams.get("exclude"));
  const varyRaw = req.nextUrl.searchParams.get("vary");
  const vary = varyRaw ?? `${q}-${Date.now()}-${hashString(req.url)}`;
  const rng = rngFromVary(vary);

  try {
    let candidates = await expandCandidatePool(q, varyRaw);

    if (excludeIds.size > 0) {
      const suffixes = [
        "hits",
        "radio",
        "album",
        "chart",
        "greatest hits",
        "best of",
        "playlist",
        "essential",
        "remaster",
        "vinyl",
        "deluxe",
      ];
      const saltBase = varyRaw ? hashString(varyRaw) : Date.now();

      let pool = candidates.filter((c) => !excludeIds.has(c.track.id));

      const mergeAlt = async (term: string) => {
        const alt = await fetchItunesPreviewTracksSafe(term);
        pool = dedupeCandidatesByTrackId([
          ...pool,
          ...alt.filter((c) => !excludeIds.has(c.track.id)),
        ]);
      };

      let round = 0;
      while (pool.length < 48 && round < suffixes.length) {
        await mergeAlt(`${q} ${suffixes[(saltBase + round) % suffixes.length]}`);
        round++;
      }

      if (pool.length === 0) {
        const extras = [`${q} songs`, `${q} various artists`, `music ${q}`, `${q} soundtrack`, `${q} megamix`];
        for (let e = 0; e < extras.length && pool.length === 0; e++) {
          await mergeAlt(extras[e]);
        }
      }

      /* Prefer songs not just shown; last resort only if iTunes truly had no other previews. */
      candidates = pool.length > 0 ? pool : candidates;
    }

    const tracks = pickDiverseTracks(candidates, rng);

    if (tracks.length === 0) {
      // Nothing with previews — fall back to bundled placeholder tracks
      const { tracks: fallbackTracks } = nextDemoScene();
      return NextResponse.json(fallbackTracks, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    const enriched = await enrichFullPlayback(tracks);
    return NextResponse.json(enriched, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("[/api/music] iTunes error:", err);
    const { tracks: fallbackTracks } = nextDemoScene();
    return NextResponse.json(fallbackTracks, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
