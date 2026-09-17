/**
 * Mean radius of Earth in kilometers (WGS-84 / IUGG standard).
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Converts degrees to radians.
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Validates coordinate ranges (-90 to 90 for latitude, -180 to 180 for longitude).
 */
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Calculates the Great Circle distance between two geographic coordinates
 * on Earth using the spherical Haversine formula.
 *
 * @param lat1 Latitude of point 1 in decimal degrees (-90 to 90)
 * @param lon1 Longitude of point 1 in decimal degrees (-180 to 180)
 * @param lat2 Latitude of point 2 in decimal degrees (-90 to 90)
 * @param lon2 Longitude of point 2 in decimal degrees (-180 to 180)
 * @returns Distance in kilometers
 */
export function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    throw new Error(
      `Invalid coordinate pair: (${lat1}, ${lon1}) and (${lat2}, ${lon2}) must be valid decimal degrees`
    );
  }

  // Exact point identity check
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) ** 2;

  // Protect against floating point precision errors exceeding 1
  const c = 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));

  return EARTH_RADIUS_KM * c;
}

/**
 * Determines whether a subscriber's location falls within the affected geographic
 * radius of a weather alert.
 *
 * MVP matching rule:
 * distance(subscriber, alertCenter) <= alert.affectedRadiusKm
 *
 * NOTE: As per project rules, the subscriber's configured radiusKm is NOT added to
 * the alert's affected radius. The alert's physical hazard perimeter dictates the match.
 */
export function isWithinAlertArea(
  subscriberLocation: { latitude: number; longitude: number },
  alert: { coordinates: { latitude: number; longitude: number }; affectedRadiusKm: number }
): boolean {
  if (!subscriberLocation || !alert || !alert.coordinates) return false;
  const distance = getDistanceKm(
    subscriberLocation.latitude,
    subscriberLocation.longitude,
    alert.coordinates.latitude,
    alert.coordinates.longitude
  );
  return distance <= alert.affectedRadiusKm;
}
