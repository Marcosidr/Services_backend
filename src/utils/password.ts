import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_SIZE = 16;
const DERIVED_KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(SALT_SIZE).toString("hex");
  const hash = scryptSync(password, salt, DERIVED_KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) return false;

  const derivedHash = scryptSync(password, salt, DERIVED_KEY_LENGTH);
  const storedHashBuffer = Buffer.from(storedHash, "hex");

  if (storedHashBuffer.length !== derivedHash.length) return false;

  return timingSafeEqual(storedHashBuffer, derivedHash);
}
