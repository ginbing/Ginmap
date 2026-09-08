import { createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from "node:crypto";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function databaseUrl(): string { return required("DATABASE_URL"); }
export function appUrl(): string { return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"; }
export function githubClientId(): string { return required("GITHUB_CLIENT_ID"); }
export function githubClientSecret(): string { return required("GITHUB_CLIENT_SECRET"); }
export function githubPublicToken(): string { return required("GITHUB_PUBLIC_TOKEN"); }
export function syncIntervalHours(): number { return Math.max(1, Number(process.env.SYNC_INTERVAL_HOURS ?? 6)); }
export function reconcileIntervalHours(): number { return Math.max(24, Number(process.env.RECONCILE_INTERVAL_HOURS ?? 168)); }
export function unclaimedRetentionDays(): number { return Math.max(1, Number(process.env.UNCLAIMED_RETENTION_DAYS ?? 30)); }
export function workerHealthPort(): number { return Math.max(1, Number(process.env.WORKER_HEALTH_PORT ?? 3001)); }
export function anonymousProfilesPerMinute(): number { return Math.max(1, Number(process.env.ANONYMOUS_PROFILES_PER_MINUTE ?? 20)); }
export function anonymousProfilesPerIpPerHour(): number { return Math.max(1, Number(process.env.ANONYMOUS_PROFILES_PER_IP_PER_HOUR ?? 30)); }

function keyFromEnv(name: string): Buffer {
  return createHash("sha256").update(required(name)).digest();
}

export function encryptToken(plainText: string): string {
  const key = keyFromEnv("TOKEN_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptToken(cipherText: string): string {
  const [version, ivText, tagText, dataText] = cipherText.split(".");
  if (version !== "v1" || !ivText || !tagText || !dataText) throw new Error("Unsupported token ciphertext");
  const key = keyFromEnv("TOKEN_ENCRYPTION_KEY");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
}

export interface SessionPayload { userId: string; version: number }

export function createSessionToken(userId: string, version: number, ttlSeconds = 60 * 60 * 24 * 30): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}.${version}.${expires}`;
  const sig = createHmac("sha256", required("SESSION_SECRET")).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [userId, versionText, expiresText, sig] = token.split(".");
  if (!userId || !versionText || !expiresText || !sig) return null;
  const version = Number(versionText);
  const expires = Number(expiresText);
  if (!Number.isInteger(version) || !Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return null;
  const payload = `${userId}.${version}.${expires}`;
  const expected = createHmac("sha256", required("SESSION_SECRET")).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return { userId, version };
}

export function createOAuthState(): string { return randomBytes(24).toString("base64url"); }
