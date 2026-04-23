import type { ListeningPlayRow, SignalsPacket } from "./types";

const STORAGE_KEY = "vibecheck_listening_v1";
const FIFO_CAP = 32;
const DEDUPE_MS = 10 * 60 * 1000;

function loadRaw(): ListeningPlayRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x === "object") as ListeningPlayRow[];
  } catch {
    return [];
  }
}

function save(rows: ListeningPlayRow[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function loadListeningHistory(): ListeningPlayRow[] {
  return loadRaw();
}

export function clearListeningHistory(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

function topGenres(rows: ListeningPlayRow[], max = 5): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const g of r.genres ?? []) {
      const k = g.trim().toLowerCase();
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([g]) => g);
}

/** Call when user meaningfully listened to a preview clip (deduped). */
export function recordPreviewListen(input: {
  deezer_track_id: number;
  title: string;
  artist_name: string;
  genres?: string[];
  play_ratio?: number;
}): void {
  const rows = loadRaw();
  const now = Date.now();
  const iso = new Date().toISOString();

  const idx = rows.findIndex((r) => r.deezer_track_id === input.deezer_track_id);
  if (idx !== -1) {
    const prev = rows[idx];
    const prevMs = new Date(prev.played_at_iso).getTime();
    if (now - prevMs < DEDUPE_MS) {
      rows[idx] = {
        ...prev,
        played_at_iso: iso,
        play_ratio: input.play_ratio ?? prev.play_ratio,
      };
      save(rows);
      return;
    }
  }

  const row: ListeningPlayRow = {
    played_at_iso: iso,
    title: input.title,
    artist_name: input.artist_name,
    deezer_track_id: input.deezer_track_id,
    genres: input.genres,
    play_ratio: input.play_ratio,
    source: "local_app",
  };
  rows.unshift(row);
  save(rows.slice(0, FIFO_CAP));
}

export function buildListeningContext(
  rows: ListeningPlayRow[]
): NonNullable<SignalsPacket["listening"]> {
  const recent = rows.slice(0, 24);
  const top = topGenres(recent);
  return {
    source: "local_app",
    recent_plays: recent,
    aggregate_hint: {
      top_genres: top,
      notes:
        recent.length === 0
          ? ""
          : `Recent in-app previews skew toward: ${top.slice(0, 3).join(", ") || "mixed"}.`,
    },
  };
}
