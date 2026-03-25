import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

type UserRole = "user" | "professional" | "admin";

export type JwtUserPayload = {
  sub: string;
  role: UserRole;
  email?: string;
};

const VALID_ROLES: UserRole[] = ["user", "professional", "admin"];
const DEFAULT_EXPIRES_IN: SignOptions["expiresIn"] = "1d";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET nao definido no .env");
  }
  return secret;
}

function getJwtExpiresIn() {
  const rawExpiresIn = process.env.JWT_EXPIRES_IN;
  if (!rawExpiresIn) return DEFAULT_EXPIRES_IN;
  return rawExpiresIn as SignOptions["expiresIn"];
}

function isJwtPayload(decoded: string | JwtPayload): decoded is JwtPayload {
  return typeof decoded !== "string";
}

function normalizeDecodedPayload(decoded: string | JwtPayload) {
  if (!isJwtPayload(decoded)) return null;

  const { sub, role, email } = decoded;
  if (typeof sub !== "string" || !sub.trim()) return null;
  if (typeof role !== "string" || !VALID_ROLES.includes(role as UserRole)) return null;
  if (typeof email !== "undefined" && typeof email !== "string") return null;

  return {
    sub,
    role: role as UserRole,
    ...(typeof email === "string" ? { email } : {})
  };
}

export function generateToken(payload: JwtUserPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn()
  });
}

export function verifyToken(token: string) {
  const decoded = jwt.verify(token, getJwtSecret());
  const normalizedPayload = normalizeDecodedPayload(decoded);

  if (!normalizedPayload) {
    throw new Error("Token invalido");
  }

  return normalizedPayload;
}

export function parseBearerAuthorization(authorizationHeader?: string) {
  if (typeof authorizationHeader !== "string") return null;

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}
