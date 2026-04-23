export const GEO_STORAGE_KEY = "vibecheck_geo_v1";

export type StoredGeo = {
  lat: number;
  lon: number;
  accuracy_m?: number;
};

export function readStoredGeo(): StoredGeo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GEO_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as StoredGeo;
    if (typeof o.lat !== "number" || typeof o.lon !== "number") return null;
    return o;
  } catch {
    return null;
  }
}

export function writeStoredGeo(geo: StoredGeo): void {
  sessionStorage.setItem(GEO_STORAGE_KEY, JSON.stringify(geo));
}

export function clearStoredGeo(): void {
  sessionStorage.removeItem(GEO_STORAGE_KEY);
}
