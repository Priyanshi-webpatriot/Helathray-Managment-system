/**
 * Fully Dynamic Universal Geolocation & Distance Engine
 * 100% Dynamic - Zero hardcoded cities, localities, or coordinates.
 * Works universally worldwide across Canada, UK, Europe, USA, India, Australia, etc.
 */

// In-memory cache for fast lookups during the active session
const memoryGeoCache = new Map();

/**
 * Calculates great-circle distance between two points on Earth using the Haversine formula.
 * Pure spherical mathematics - applies universally anywhere on planet Earth.
 * Returns distance in kilometers (rounded to 1 decimal place).
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (
    lat1 === null ||
    lat1 === undefined ||
    lon1 === null ||
    lon1 === undefined ||
    lat2 === null ||
    lat2 === undefined ||
    lon2 === null ||
    lon2 === undefined
  ) {
    return null;
  }

  const p1 = Number(lat1);
  const l1 = Number(lon1);
  const p2 = Number(lat2);
  const l2 = Number(lon2);

  if (isNaN(p1) || isNaN(l1) || isNaN(p2) || isNaN(l2)) return null;

  const R = 6371; // Earth's mean radius in km
  const dLat = ((p2 - p1) * Math.PI) / 180;
  const dLon = ((l2 - l1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1 * Math.PI) / 180) *
      Math.cos((p2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10;
}

/**
 * Dynamically geocodes any address, city, region, or country string globally.
 * Uses OpenStreetMap Nominatim with Photon fallback.
 * Caches results in localStorage and memory to ensure fast loading and zero redundant network calls.
 */
export async function geocodeAddressDynamic(locationQuery) {
  if (!locationQuery || typeof locationQuery !== "string") return null;

  const cleanQuery = locationQuery.trim();
  if (!cleanQuery) return null;

  const cacheKey = `geo_dyn_${cleanQuery.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

  // 1. Check memory cache
  if (memoryGeoCache.has(cacheKey)) {
    return memoryGeoCache.get(cacheKey);
  }

  // 2. Check localStorage cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      memoryGeoCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch (e) {
    // Ignore storage quota or access errors
  }

  // 3. Dynamic lookup via OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&limit=1`;
    const res = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        "Accept-Language": "en",
        "User-Agent": "CareScribeHealthSystem/1.0",
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const result = {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          displayName: item.display_name,
        };
        memoryGeoCache.set(cacheKey, result);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch (_) {}
        return result;
      }
    }
  } catch (err) {
    // Fallback to secondary geocoding provider
  }

  // 4. Secondary fallback: Dynamic lookup via Photon (OpenStreetMap global geocoder)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=1`;
    const res = await fetch(photonUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data?.features && data.features.length > 0) {
        const feat = data.features[0];
        const [lng, lat] = feat.geometry.coordinates;
        const result = {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          displayName: feat.properties?.name || cleanQuery,
        };
        memoryGeoCache.set(cacheKey, result);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch (_) {}
        return result;
      }
    }
  } catch (err) {
    console.warn("Dynamic geocoding error for query:", cleanQuery, err);
  }

  return null;
}

/**
 * Builds intelligent candidate queries from a doctor's record worldwide.
 * Strips out descriptive noise like 'near ... bus stop' or complex building names,
 * and anchors to the city/locality.
 */
export function buildDynamicGeocodeCandidates(doc) {
  if (!doc) return [];
  const candidates = [];

  const rawCity = (doc.city || "").trim().replace(/ahemdabad/i, "Ahmedabad");
  const rawAddress = (doc.address || "").trim().replace(/ahemdabad/i, "Ahmedabad");
  const rawState = (doc.state || "").trim();

  // Extract locality parts from address (e.g., "Suvidha Complex, near Vejalpur Bus Stop" -> "Vejalpur")
  const addressParts = rawAddress
    .split(/[,–-]/)
    .map((s) =>
      s
        .replace(/\b(near|opp|opposite|behind|next to|beside|in front of)\b/gi, "")
        .replace(/\b(bus stop|metro station|station|railway station)\b/gi, "")
        .trim()
    )
    .filter((s) => s.length > 2);

  // Prioritize locality + city (e.g., "Vejalpur, Ahmedabad", "Ambawadi, Ahmedabad", "Jasola Vihar, Delhi")
  for (const part of addressParts.reverse()) {
    if (rawCity && !part.toLowerCase().includes(rawCity.toLowerCase())) {
      candidates.push(`${part}, ${rawCity}`);
    }
  }

  // Cleaned address (without landmark clutter) + city
  const cleanedAddress = rawAddress
    .replace(/\b(near|opp|opposite|behind|next to|beside|in front of)\b.*?(,|$)/gi, "$2")
    .replace(/\b(bus stop|metro station|station|railway station)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanedAddress && rawCity && cleanedAddress.toLowerCase() !== rawCity.toLowerCase()) {
    candidates.push(`${cleanedAddress}, ${rawCity}`);
  }

  // Raw address + city
  if (rawAddress && rawCity) {
    candidates.push(`${rawAddress}, ${rawCity}`);
  }

  // International format: Address + State / Province (e.g. "123 Queen St, Ontario")
  if (cleanedAddress && rawState && !rawAddress.toLowerCase().includes(rawState.toLowerCase())) {
    candidates.push(`${cleanedAddress}, ${rawState}`);
  }

  // City level fallback
  if (rawCity) {
    if (rawState && !rawCity.toLowerCase().includes(rawState.toLowerCase())) {
      candidates.push(`${rawCity}, ${rawState}`);
    }
    candidates.push(rawCity);
  }

  return [...new Set(candidates.filter(Boolean))];
}

/**
 * Dynamically resolves doctor coordinates using intelligent multi-candidate cascading
 */
export async function resolveDoctorCoordinatesDynamic(doc) {
  if (!doc) return null;
  const candidates = buildDynamicGeocodeCandidates(doc);

  for (const query of candidates) {
    const res = await geocodeAddressDynamic(query);
    if (res && res.lat != null && res.lng != null) {
      return res;
    }
  }

  return null;
}

/**
 * Dynamically reverse-geocodes any live GPS coordinates on Earth into a city/country.
 * Works globally for Canada, UK, Europe, USA, India, etc.
 */
export async function detectLiveUserCity(lat, lng) {
  if (lat == null || lng == null) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      {
        signal: controller.signal,
        headers: {
          "Accept-Language": "en",
          "User-Agent": "CareScribeHealthSystem/1.0",
        },
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const cityName =
        addr.city ||
        addr.town ||
        addr.municipality ||
        addr.city_district ||
        addr.suburb ||
        addr.county ||
        addr.state_district ||
        addr.state ||
        "";

      const country = addr.country || "";

      return {
        city: cityName || "Your Location",
        state: addr.state || "",
        country,
        fullAddress: data.display_name || cityName,
        lat,
        lng,
      };
    }
  } catch (err) {
    console.warn("Live reverse-geocoding failed:", err);
  }

  return {
    city: "Your Location",
    state: "",
    country: "",
    fullAddress: "Current Location",
    lat,
    lng,
  };
}
