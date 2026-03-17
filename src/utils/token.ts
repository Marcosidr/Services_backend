import { randomBytes } from "node:crypto";

export function createAuthToken(userId: string) {
  const nonce = randomBytes(24).toString("hex");
  return `${userId}.${nonce}`;
}
