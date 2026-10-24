/**
 * Geographical Coordinates and Haversine Distance Calculation Utilities
 * Supports Mizoram towns, localities, and embedded GPS coordinates
 */

export interface GeoPoint {
  name: string;
  lat: number;
  lng: number;
}

export const MIZORAM_GEO_DATABASE: GeoPoint[] = [
  // Lunglei Core Localities & Towns
  { name: 'Zobawk, Lunglei', lat: 22.8420, lng: 92.7480 },
  { name: 'Venglai, Lunglei', lat: 22.8940, lng: 92.7420 },
  { name: 'Bazar Veng, Lunglei', lat: 22.8890, lng: 92.7400 },
  { name: 'Chanmari, Lunglei', lat: 22.8980, lng: 92.7380 },
  { name: 'Rahsi Veng, Lunglei', lat: 22.8820, lng: 92.7450 },
  { name: 'Farm Veng, Lunglei', lat: 22.8760, lng: 92.7440 },
  { name: 'Electric Veng, Lunglei', lat: 22.8910, lng: 92.7350 },
  { name: 'Serkawn, Lunglei', lat: 22.9120, lng: 92.7550 },
  { name: 'Luangmual, Lunglei', lat: 22.9050, lng: 92.7310 },
  { name: 'Pukpui, Lunglei', lat: 22.9240, lng: 92.7680 },
  { name: 'Lunglei, Mizoram', lat: 22.8872, lng: 92.7410 },
  { name: 'Tlabung, Lunglei', lat: 22.8950, lng: 92.4850 },
  { name: 'Haulawng, Lunglei', lat: 22.9900, lng: 92.7800 },
  { name: 'Tawipui, Lunglei', lat: 22.7100, lng: 92.7900 },
  { name: 'Tawipui N-II, Lunglei', lat: 22.7120, lng: 92.7920 },

  // Aizawl Core Localities
  { name: 'Khatla, Aizawl', lat: 23.7160, lng: 92.7140 },
  { name: 'Bungkawn, Aizawl', lat: 23.7230, lng: 92.7160 },
  { name: 'Dawrpui, Aizawl', lat: 23.7335, lng: 92.7176 },
  { name: 'Chanmari, Aizawl', lat: 23.7431, lng: 92.7196 },
  { name: 'Bawngkawn, Aizawl', lat: 23.7594, lng: 92.7302 },
  { name: 'Kulikawn, Aizawl', lat: 23.7050, lng: 92.7190 },
  { name: 'Mission Veng, Aizawl', lat: 23.7190, lng: 92.7185 },
  { name: 'Ramhlun, Aizawl', lat: 23.7505, lng: 92.7270 },
  { name: 'Zarkawt, Aizawl', lat: 23.7380, lng: 92.7180 },
  { name: 'Tuikual, Aizawl', lat: 23.7300, lng: 92.7120 },
  { name: 'Vaivakawn, Aizawl', lat: 23.7450, lng: 92.7050 },
  { name: 'Zemabawk, Aizawl', lat: 23.7610, lng: 92.7520 },
  { name: 'Armed Veng, Aizawl', lat: 23.7380, lng: 92.7310 },
  { name: 'Electric Veng, Aizawl', lat: 23.7370, lng: 92.7240 },
  { name: 'Bethlehem, Aizawl', lat: 23.7250, lng: 92.7320 },
  { name: 'Chaltlang, Aizawl', lat: 23.7520, lng: 92.7220 },
  { name: 'Durtlang, Aizawl', lat: 23.7850, lng: 92.7360 },
  { name: 'Sairang, Aizawl', lat: 23.7990, lng: 92.6580 },
  { name: 'Lengpui, Mizoram', lat: 23.8380, lng: 92.6280 },
  { name: 'Aizawl, Mizoram', lat: 23.7271, lng: 92.7176 },

  // Champhai District & Localities
  { name: 'Champhai, Mizoram', lat: 23.4735, lng: 93.3283 },
  { name: 'Vengthlang, Champhai', lat: 23.4680, lng: 93.3250 },
  { name: 'Kahrawt, Champhai', lat: 23.4790, lng: 93.3320 },
  { name: 'Zokhawthar, Champhai', lat: 23.3680, lng: 93.3850 },

  // Kolasib District
  { name: 'Kolasib, Mizoram', lat: 24.2256, lng: 92.6782 },
  { name: 'Vairengte, Kolasib', lat: 24.5050, lng: 92.7600 },
  { name: 'Bairabi, Kolasib', lat: 24.1900, lng: 92.5350 },
  { name: 'Bilkhawthlir, Kolasib', lat: 24.3350, lng: 92.7200 },

  // Serchhip District
  { name: 'Serchhip, Mizoram', lat: 23.3417, lng: 92.8504 },
  { name: 'Thenzawl, Serchhip', lat: 23.2850, lng: 92.7650 },
  { name: 'North Vanlaiphai, Serchhip', lat: 23.1350, lng: 93.0700 },
  { name: 'Chhiahtlang, Serchhip', lat: 23.3950, lng: 92.8350 },

  // Siaha District
  { name: 'Siaha, Mizoram', lat: 22.4897, lng: 92.9774 },
  { name: 'Tuipang, Siaha', lat: 22.3150, lng: 93.0250 },

  // Lawngtlai District
  { name: 'Lawngtlai, Mizoram', lat: 22.5278, lng: 92.8920 },
  { name: 'Chawngte, Lawngtlai', lat: 22.6450, lng: 92.6450 },
  { name: 'Sangau, Lawngtlai', lat: 22.7450, lng: 93.0600 },

  // Mamit District
  { name: 'Mamit, Mizoram', lat: 23.9268, lng: 92.4905 },
  { name: 'Zawlnuam, Mamit', lat: 24.1350, lng: 92.3450 },
  { name: 'West Phaileng, Mamit', lat: 23.7850, lng: 92.4150 },

  // Saitual District
  { name: 'Saitual, Mizoram', lat: 23.9700, lng: 92.5700 },
  { name: 'Keifang, Saitual', lat: 23.9550, lng: 92.5850 },
  { name: 'Ngopa, Saitual', lat: 23.8850, lng: 93.2050 },

  // Khawzawl District
  { name: 'Khawzawl, Mizoram', lat: 23.5350, lng: 93.1850 },
  { name: 'Khawhai, Khawzawl', lat: 23.3450, lng: 93.1650 },

  // Hnahthial District
  { name: 'Hnahthial, Mizoram', lat: 22.9650, lng: 92.9300 },
  { name: 'South Vanlaiphai, Hnahthial', lat: 23.0150, lng: 92.9950 },

  // Other Common Hubs
  { name: 'Shillong, Meghalaya', lat: 25.5788, lng: 91.8933 },
  { name: 'Guwahati, Assam', lat: 26.1445, lng: 91.7362 },
];

/**
 * Calculates great-circle distance between two GPS coordinates using the Haversine formula (in kilometers)
 */
export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parses GPS coordinates from string format: "latitude, longitude" or "lat, lng"
 */
export function parseGpsCoords(coordsStr?: string): { lat: number; lng: number } | null {
  if (!coordsStr || typeof coordsStr !== 'string') return null;
  const clean = coordsStr.replace(/[^\d.,\-+ ]/g, '').trim();
  const parts = clean.split(',').map(s => s.trim());
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Extracts best known GPS coordinates for a campaign.
 * First checks campaign.gpsCoords; if absent, looks up campaign.location in MIZORAM_GEO_DATABASE.
 */
export function getCampaignCoordinates(campaign: { gpsCoords?: string; location?: string }): { lat: number; lng: number } | null {
  if (campaign.gpsCoords) {
    const parsed = parseGpsCoords(campaign.gpsCoords);
    if (parsed) return parsed;
  }

  if (campaign.location) {
    const locLower = campaign.location.toLowerCase();
    const matched = MIZORAM_GEO_DATABASE.find(point => {
      const pNameLower = point.name.toLowerCase();
      const simpleName = point.name.split(',')[0].toLowerCase().trim();
      return locLower.includes(simpleName) || pNameLower.includes(locLower);
    });
    if (matched) {
      return { lat: matched.lat, lng: matched.lng };
    }
  }

  return null;
}

/**
 * Formats distance into human-readable string (e.g., "450 m", "1.2 km", "24 km")
 */
export function formatDistance(distanceKm: number, language: 'mizo' | 'english' = 'mizo'): string {
  if (distanceKm < 0.1) {
    return language === 'mizo' ? 'Hnai te (< 100 m)' : 'Nearby (< 100 m)';
  }
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km`;
  }
  return `${Math.round(distanceKm)} km`;
}
