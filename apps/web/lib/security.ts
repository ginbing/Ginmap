import type { NextRequest } from "next/server";

export function requireSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  if (!origin || origin !== expected) throw new Error("Cross-origin form submission rejected");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") throw new Error("Cross-site form submission rejected");
}
