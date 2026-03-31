import { isValidCep, normalizeCep } from "../utils/cep";
import { parseLatitude, parseLongitude, validateCoordinatePair } from "../utils/geo";

type UpdateProfessionalProfileInput = {
  description?: string;
  experience?: string;
  price?: string | number;
  priceUnit?: string;
  area?: string | number;
  cep?: string;
  city?: string;
  online?: boolean | string;
  photoUrl?: string;
  latitude?: string | number;
  longitude?: string | number;
};

type BuildUpdatePayloadResult =
  | {
      ok: true;
      payload: Record<string, unknown>;
    }
  | {
      ok: false;
      status: 400;
      message: string;
    };

function parseOptionalNumber(value: unknown) {
  if (typeof value === "undefined" || value === null || value === "") return null;

  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function parseOnlineFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "sim";
  }

  return false;
}

function normalizeOptionalText(value: string | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePhotoUrl(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function buildProfessionalProfileUpdatePayload(
  input: UpdateProfessionalProfileInput,
  currentAreaKm: number
): BuildUpdatePayloadResult {
  const {
    description,
    experience,
    price,
    priceUnit,
    area,
    cep,
    city,
    online,
    photoUrl,
    latitude,
    longitude
  } = input;

  const parsedLatitude = parseLatitude(latitude);
  const parsedLongitude = parseLongitude(longitude);
  const coordinateError = validateCoordinatePair(parsedLatitude, parsedLongitude);
  if (coordinateError) {
    return { ok: false, status: 400, message: coordinateError };
  }

  if (typeof cep === "string" && cep.trim() && !isValidCep(cep)) {
    return { ok: false, status: 400, message: "CEP invalido" };
  }

  const parsedPrice = parseOptionalNumber(price);
  if (typeof price !== "undefined" && price !== null && price !== "" && parsedPrice === null) {
    return { ok: false, status: 400, message: "price invalido" };
  }

  const parsedArea = parseOptionalNumber(area);
  if (typeof area !== "undefined" && area !== null && area !== "" && parsedArea === null) {
    return { ok: false, status: 400, message: "area invalida" };
  }

  const payload: Record<string, unknown> = {
    ...(typeof description !== "undefined" ? { description: normalizeOptionalText(description) } : {}),
    ...(typeof experience !== "undefined" ? { experience: normalizeOptionalText(experience) } : {}),
    ...(typeof price !== "undefined" ? { price: parsedPrice } : {}),
    ...(typeof priceUnit !== "undefined" ? { priceUnit: normalizeOptionalText(priceUnit) ?? "servico" } : {}),
    ...(typeof area !== "undefined"
      ? { areaKm: parsedArea && parsedArea > 0 ? Math.round(parsedArea) : currentAreaKm }
      : {}),
    ...(typeof cep !== "undefined"
      ? { cep: typeof cep === "string" && cep.trim() ? normalizeCep(cep) : null }
      : {}),
    ...(typeof city !== "undefined" ? { city: normalizeOptionalText(city) } : {}),
    ...(typeof online !== "undefined" ? { online: parseOnlineFlag(online) } : {}),
    ...(typeof photoUrl !== "undefined" ? { photoUrl: normalizePhotoUrl(photoUrl) || null } : {}),
    ...(parsedLatitude.provided ? { latitude: parsedLatitude.value } : {}),
    ...(parsedLongitude.provided ? { longitude: parsedLongitude.value } : {})
  };

  return { ok: true, payload };
}
