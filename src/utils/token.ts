import { randomBytes } from "node:crypto";

export function createAuthToken(userId: number) {
  const nonce = randomBytes(24).toString("hex");
  return `${userId}.${nonce}`;
}
