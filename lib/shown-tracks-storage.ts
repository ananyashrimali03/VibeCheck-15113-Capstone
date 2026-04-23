/** iTunes track ids already shown in this browser — avoid repeating them on reshuffle / re-read. */

const KEY = "vibecheck_seen_itunes_track_ids_v1";
const MAX_IDS = 400;
/** Keep newest ids for exclude param (URL length); server still merges wide pools. */
export const EXCLUDE_CAP = 200;

export function loadSeenTrackIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  } catch {
    return [];
  }
}

/** Append ids (dedupe: moving a repeated id to the end). Trim oldest when over cap. */
export function recordShownTrackIds(ids: number[]): void {
  if (typeof window === "undefined" || ids.length === 0) return;
  let order = loadSeenTrackIds();
  for (const id of ids) {
    order = order.filter((x) => x !== id);
    order.push(id);
  }
  while (order.length > MAX_IDS) order.shift();
  window.localStorage.setItem(KEY, JSON.stringify(order));
}

export function clearShownTrackIds(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/** Comma-separated exclude list for ?exclude= (capped). */
export function formatExcludeParam(ids: Iterable<number>): string {
  const arr = [...new Set(ids)];
  const tail = arr.length > EXCLUDE_CAP ? arr.slice(arr.length - EXCLUDE_CAP) : arr;
  return tail.join(",");
}
