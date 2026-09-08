import { createHash } from "node:crypto";

export function requesterKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const direct = headers.get("x-real-ip")?.trim();
  const value = forwarded || direct || "unknown";
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}
