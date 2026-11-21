export interface CachedGeoLocation {
  lat: number
  lon: number
  ts: number
}

const GEO_CACHE_KEY = 'joodpakpaw_geo'
const GEO_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Reads cached user coordinates from sessionStorage if present and within the 5-minute TTL.
 * Must only be called on the client (e.g., inside useEffect) to avoid SSR hydration mismatches.
 */
export function readGeoCache(): { lat: number; lon: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(GEO_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedGeoLocation>
    if (
      typeof parsed.lat !== 'number' ||
      !Number.isFinite(parsed.lat) ||
      typeof parsed.lon !== 'number' ||
      !Number.isFinite(parsed.lon) ||
      typeof parsed.ts !== 'number' ||
      !Number.isFinite(parsed.ts)
    ) {
      return null
    }
    if (Date.now() - parsed.ts > GEO_TTL_MS) {
      window.sessionStorage.removeItem(GEO_CACHE_KEY)
      return null
    }
    return { lat: parsed.lat, lon: parsed.lon }
  } catch {
    return null
  }
}

/**
 * Persists user coordinates and timestamp to sessionStorage for 5-minute reuse across browse routes.
 */
export function writeGeoCache(lat: number, lon: number): void {
  if (typeof window === 'undefined') return
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
  try {
    const payload: CachedGeoLocation = { lat, lon, ts: Date.now() }
    window.sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage quota or private browsing errors
  }
}
