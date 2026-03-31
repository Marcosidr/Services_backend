export type CoordinateParseResult = {
  provided: boolean;
  value: number | null;
  invalid: boolean;
};

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

function parseCoordinate(value: unknown, min: number, max: number): CoordinateParseResult {
  if (typeof value === "undefined" || value === null) {
    return { provided: false, value: null, invalid: false };
  }

  if (typeof value === "string" && !value.trim()) {
    return { provided: false, value: null, invalid: false };
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { provided: true, value: null, invalid: true };
  }

  return { provided: true, value: parsed, invalid: false };
}

export function parseLatitude(value: unknown) {
  return parseCoordinate(value, -90, 90);
}

export function parseLongitude(value: unknown) {
  return parseCoordinate(value, -180, 180);
}

export function validateCoordinatePair(
  latitude: CoordinateParseResult,
  longitude: CoordinateParseResult
) {
  if (latitude.invalid || longitude.invalid) {
    return "Latitude/longitude invalidas";
  }

  if (latitude.provided !== longitude.provided) {
    return "Informe latitude e longitude juntas";
  }

  return null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(from: GeoPoint, to: GeoPoint) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(to.latitude - from.latitude);
  const lonDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(lonDelta / 2) *
      Math.sin(lonDelta / 2);

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Number((earthRadiusKm * arc).toFixed(1));
}
