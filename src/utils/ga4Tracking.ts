import { resolveApiUrl } from './apiConfig';

export interface GpsVisitorLocation {
  city: string;
  locality?: string;
  district?: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  accuracy?: number;
  detectedAt: number;
  source: 'gps';
}

const GPS_CACHE_KEY = 'ronpay_gps_visitor_location_v1';
const GPS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// High-precision coordinates for Mizoram District HQs & Major Towns
const MIZORAM_TOWNS: Array<{
  name: string;
  district: string;
  lat: number;
  lng: number;
  radiusKm: number;
}> = [
  { name: 'Aizawl', district: 'Aizawl', lat: 23.7271, lng: 92.7176, radiusKm: 18 },
  { name: 'Lunglei', district: 'Lunglei', lat: 22.8866, lng: 92.7342, radiusKm: 18 },
  { name: 'Champhai', district: 'Champhai', lat: 23.4566, lng: 93.3282, radiusKm: 15 },
  { name: 'Kolasib', district: 'Kolasib', lat: 24.2246, lng: 92.6760, radiusKm: 14 },
  { name: 'Serchhip', district: 'Serchhip', lat: 23.3417, lng: 92.8502, radiusKm: 14 },
  { name: 'Lawngtlai', district: 'Lawngtlai', lat: 22.5284, lng: 92.8926, radiusKm: 15 },
  { name: 'Siaha (Saiha)', district: 'Siaha', lat: 22.4897, lng: 92.9793, radiusKm: 15 },
  { name: 'Mamit', district: 'Mamit', lat: 23.9293, lng: 92.4906, radiusKm: 14 },
  { name: 'Saitual', district: 'Saitual', lat: 23.6795, lng: 92.9598, radiusKm: 12 },
  { name: 'Khawzawl', district: 'Khawzawl', lat: 23.5350, lng: 93.1830, radiusKm: 12 },
  { name: 'Hnahthial', district: 'Hnahthial', lat: 22.9653, lng: 92.9301, radiusKm: 12 },
  { name: 'Thenzawl', district: 'Serchhip', lat: 23.2816, lng: 92.7744, radiusKm: 10 },
  { name: 'Vairengte', district: 'Kolasib', lat: 24.5042, lng: 92.7611, radiusKm: 10 },
  { name: 'Bairabi', district: 'Kolasib', lat: 24.1819, lng: 92.5367, radiusKm: 10 },
  { name: 'Tlabung', district: 'Lunglei', lat: 22.9056, lng: 92.4945, radiusKm: 12 },
  { name: 'Lengpui', district: 'Mamit', lat: 23.8407, lng: 92.6197, radiusKm: 10 },
  { name: 'Darlawn', district: 'Aizawl', lat: 24.0156, lng: 92.9278, radiusKm: 10 },
  { name: 'Biate', district: 'Serchhip', lat: 23.2494, lng: 93.1208, radiusKm: 10 },
  { name: 'North Vanlaiphai', district: 'Serchhip', lat: 23.1333, lng: 93.0667, radiusKm: 10 },
  { name: 'Sangau', district: 'Lawngtlai', lat: 22.7397, lng: 93.0583, radiusKm: 10 },
  { name: 'Chawngte', district: 'Lawngtlai', lat: 22.6167, lng: 92.6333, radiusKm: 10 },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchNearestMizoramTown(lat: number, lng: number): { city: string; district: string; state: string } | null {
  let best: { name: string; district: string; distKm: number; radiusKm: number } | null = null;
  for (const t of MIZORAM_TOWNS) {
    const distKm = haversineKm(lat, lng, t.lat, t.lng);
    if (!best || distKm < best.distKm) {
      best = { name: t.name, district: t.district, distKm, radiusKm: t.radiusKm };
    }
  }
  if (best && best.distKm <= best.radiusKm) {
    return { city: best.name, district: best.district, state: 'Mizoram' };
  }
  // Check if within Mizoram bounding box (21.9°N to 24.6°N, 92.2°E to 93.5°E)
  if (lat >= 21.9 && lat <= 24.6 && lng >= 92.2 && lng <= 93.5 && best) {
    return { city: best.name, district: best.district, state: 'Mizoram' };
  }
  return null;
}

export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return 'anon';
  try {
    let vid = localStorage.getItem('ronpay_visitor_id_v1');
    if (!vid) {
      vid = 'vis-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
      localStorage.setItem('ronpay_visitor_id_v1', vid);
    }
    return vid;
  } catch {
    return 'anon-' + Date.now();
  }
}

export function getCachedUserGpsLocation(): GpsVisitorLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GPS_CACHE_KEY);
    if (!raw) return null;
    const parsed: GpsVisitorLocation = JSON.parse(raw);
    if (parsed && parsed.city && Date.now() - (parsed.detectedAt || 0) < GPS_CACHE_TTL_MS) {
      return parsed;
    }
    return parsed?.city ? parsed : null;
  } catch {
    return null;
  }
}

let pendingGpsPromise: Promise<GpsVisitorLocation | null> | null = null;

export async function detectAndCacheUserGpsLocation(forceRefresh: boolean = false): Promise<GpsVisitorLocation | null> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) return null;

  if (!forceRefresh) {
    const cached = getCachedUserGpsLocation();
    if (cached && Date.now() - cached.detectedAt < GPS_CACHE_TTL_MS) {
      return cached;
    }
  }

  if (pendingGpsPromise && !forceRefresh) return pendingGpsPromise;

  pendingGpsPromise = new Promise<GpsVisitorLocation | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        const accuracy = Math.round(pos.coords.accuracy || 0);

        // 1. Instant local Mizoram coordinate match
        const mizoMatch = matchNearestMizoramTown(lat, lng);
        let city = mizoMatch?.city || 'Mizoram';
        let locality = '';
        let district = mizoMatch?.district || '';
        let state = mizoMatch?.state || 'Mizoram';
        let country = 'India';

        // 2. Enrich with OpenStreetMap Nominatim reverse geocoding (non-blocking timeout 3.5s)
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3500);
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
            {
              signal: controller.signal,
              headers: { 'Accept-Language': 'en' }
            }
          );
          clearTimeout(timer);
          if (nomRes.ok) {
            const nomJson = await nomRes.json();
            const addr = nomJson?.address || {};
            const nomSuburb = addr.suburb || addr.neighbourhood || addr.village || '';
            const nomTown = addr.town || addr.city || addr.municipality || addr.county || '';
            const nomState = addr.state || state;
            const nomCountry = addr.country || 'India';

            if (mizoMatch) {
              // Keep clean Mizoram town name (e.g., "Lunglei" or "Aizawl") so stats group cleanly
              city = mizoMatch.city;
              locality = nomSuburb && nomSuburb.toLowerCase() !== city.toLowerCase() ? nomSuburb : '';
            } else if (nomTown) {
              city = nomTown;
              locality = nomSuburb;
            }
            state = nomState;
            country = nomCountry;
          }
        } catch {
          // Offline or Nominatim rate-limited; mizoMatch is already accurate
        }

        const result: GpsVisitorLocation = {
          city,
          locality: locality || undefined,
          district: district || undefined,
          state,
          country,
          lat,
          lng,
          accuracy,
          detectedAt: Date.now(),
          source: 'gps',
        };

        try {
          localStorage.setItem(GPS_CACHE_KEY, JSON.stringify(result));
        } catch {}

        // Immediately notify backend analytics hit endpoint with exact GPS city
        sendAnalyticsHitToBackend(window.location.pathname || '/', document.title || 'RonPay App', result);

        pendingGpsPromise = null;
        resolve(result);
      },
      () => {
        pendingGpsPromise = null;
        resolve(getCachedUserGpsLocation());
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: forceRefresh ? 0 : 10 * 60 * 1000,
      }
    );
  });

  return pendingGpsPromise;
}

function sendAnalyticsHitToBackend(pagePath: string, title: string, gpsLoc?: GpsVisitorLocation | null) {
  try {
    const visitorId = getOrCreateVisitorId();
    const loc = gpsLoc !== undefined ? gpsLoc : getCachedUserGpsLocation();
    const endpoint = resolveApiUrl('/api/analytics/hit');
    const payload = JSON.stringify({
      path: pagePath,
      title,
      visitorId,
      gpsCity: loc?.city,
      gpsLocality: loc?.locality,
      gpsState: loc?.state,
      gpsCountry: loc?.country || 'India',
      lat: loc?.lat,
      lng: loc?.lng,
      isGps: Boolean(loc?.city),
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silently continue
  }
}

/**
 * Safely tracks GA4 page views and custom events for React SPA page transitions
 */
export function trackGA4PageView(pagePath: string, pageTitle?: string) {
  if (typeof window === 'undefined') return;
  const title = pageTitle || document.title || 'RonPay App';
  const visitorId = getOrCreateVisitorId();
  const cachedGps = getCachedUserGpsLocation();

  // 1. Google Analytics Client Tag
  try {
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      const measurementId = localStorage.getItem('ronpay_ga_measurement_id') || 'G-P29J9QMYK6';
      gtag('config', measurementId, {
        page_path: pagePath,
        page_title: title,
        page_location: window.location.href,
        user_id: visitorId,
        ...(cachedGps?.city ? { user_properties: { gps_city: cachedGps.city, gps_state: cachedGps.state } } : {}),
      });
      gtag('event', 'page_view', {
        page_path: pagePath,
        page_title: title,
        page_location: window.location.href,
        user_id: visitorId,
        ...(cachedGps?.city ? { gps_city: cachedGps.city, gps_state: cachedGps.state } : {}),
        send_to: measurementId,
      });
    }
  } catch {
    // Silently ignore if blocked by adblocker
  }

  // 2. Direct First-Party Backend Beacon Hit (with cached GPS if available)
  sendAnalyticsHitToBackend(pagePath, title, cachedGps);

  // 3. Trigger GPS detection in background if not yet cached or expired
  if (!cachedGps) {
    detectAndCacheUserGpsLocation(false).catch(() => {});
  }
}

export function trackGA4Event(eventName: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  try {
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      gtag('event', eventName, params || {});
    }
  } catch {
    // Silently ignore
  }
}
