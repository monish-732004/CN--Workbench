import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SECRET = process.env.QUIZ_SECRET || "cn-workbench-dev-secret-change-me";

/** 16-byte seed: HMAC(secret, parts). Students cannot predict each other's instances. */
export function seedFor(...parts: (string | number)[]): Uint8Array {
  return new Uint8Array(createHmac("sha256", SECRET).update(parts.join("|")).digest().subarray(0, 16));
}

export function token(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const CODE_ALPHABET = "ACDEFHJKMNPQRTUVWXY3479";
export function roomCode() {
  const bytes = randomBytes(6);
  let s = "";
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}
