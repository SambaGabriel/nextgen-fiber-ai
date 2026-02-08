/**
 * GPS Location Service for NextGen Fiber AI
 * Helps linemen log their location when submitting production
 */

// Types
export interface Coordinates {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
}

export interface LocationError {
  code: string;
  message: string;
}

// Cache for reverse geocoding results
const geocodeCache = new Map<string, Address>();

/**
 * Get current GPS coordinates with high accuracy
 * @returns Promise<Coordinates>
 */
export async function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 'GEOLOCATION_NOT_SUPPORTED',
        message: 'Geolocation is not supported by your browser. Please use a modern browser or enable location services.',
      } as LocationError);
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        reject(handleGeolocationError(error));
      },
      options
    );
  });
}

/**
 * Watch position continuously with battery-efficient options
 * @param callback - Function called on each position update
 * @returns Cleanup function to stop watching
 */
export function watchPosition(
  callback: (position: Coordinates) => void,
  onError?: (error: LocationError) => void
): () => void {
  if (!navigator.geolocation) {
    if (onError) {
      onError({
        code: 'GEOLOCATION_NOT_SUPPORTED',
        message: 'Geolocation is not supported by your browser.',
      });
    }
    return () => {};
  }

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 10000, // Allow cached positions up to 10 seconds for battery efficiency
  };

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      callback({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
    },
    (error) => {
      if (onError) {
        onError(handleGeolocationError(error));
      }
    },
    options
  );

  // Return cleanup function
  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}

/**
 * Get address from coordinates using Nominatim OpenStreetMap API
 * Results are cached to reduce API calls
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Promise<Address>
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<Address> {
  // Create cache key with reduced precision (5 decimal places ~ 1 meter accuracy)
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;

  // Check cache first
  const cached = geocodeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'NextGenFiberAI/1.0',
          'Accept-Language': 'en-US,en',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    const address: Address = {
      street: data.address?.road || data.address?.street || '',
      city: data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || '',
      state: data.address?.state || '',
      country: data.address?.country || '',
    };

    // Cache the result
    geocodeCache.set(cacheKey, address);

    return address;
  } catch (error) {
    console.error('[LocationService] Geocoding error:', error);
    throw {
      code: 'GEOCODING_FAILED',
      message: 'Unable to get address for this location. Please check your internet connection.',
    } as LocationError;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Distance in feet
 */
export function calculateDistance(
  pos1: { lat: number; lng: number },
  pos2: { lat: number; lng: number }
): number {
  const R = 20902231; // Earth's radius in feet

  const lat1Rad = toRadians(pos1.lat);
  const lat2Rad = toRadians(pos2.lat);
  const deltaLat = toRadians(pos2.lat - pos1.lat);
  const deltaLng = toRadians(pos2.lng - pos1.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if current position is near job location
 * @param currentPos - Current GPS position
 * @param jobLocation - Job site location
 * @param thresholdFeet - Maximum allowed distance (default 500 feet)
 * @returns Boolean indicating if within threshold
 */
export function isNearJobLocation(
  currentPos: { lat: number; lng: number },
  jobLocation: { lat: number; lng: number },
  thresholdFeet: number = 500
): boolean {
  const distance = calculateDistance(currentPos, jobLocation);
  return distance <= thresholdFeet;
}

/**
 * Format coordinates in human-readable format
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Formatted string like "34.0522° N, 118.2437° W"
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDirection = lat >= 0 ? 'N' : 'S';
  const lngDirection = lng >= 0 ? 'E' : 'W';

  const latFormatted = Math.abs(lat).toFixed(4);
  const lngFormatted = Math.abs(lng).toFixed(4);

  return `${latFormatted}° ${latDirection}, ${lngFormatted}° ${lngDirection}`;
}

// Helper functions

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Handle geolocation errors with user-friendly messages
 */
function handleGeolocationError(error: GeolocationPositionError): LocationError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return {
        code: 'PERMISSION_DENIED',
        message: 'Location access denied. Please enable location permissions in your browser settings to submit production.',
      };
    case error.POSITION_UNAVAILABLE:
      return {
        code: 'POSITION_UNAVAILABLE',
        message: 'Unable to determine your location. Please ensure GPS is enabled and you have a clear view of the sky.',
      };
    case error.TIMEOUT:
      return {
        code: 'TIMEOUT',
        message: 'Location request timed out. Please try again or move to an area with better GPS signal.',
      };
    default:
      return {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred while getting your location. Please try again.',
      };
  }
}

/**
 * Clear the geocode cache (useful for testing or memory management)
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}

/**
 * Get cache size for debugging
 */
export function getGeocodeCacheSize(): number {
  return geocodeCache.size;
}
