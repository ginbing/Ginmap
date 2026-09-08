import type { NextRequest } from "next/server";

export function requireSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const expected = new URL(request.url).origin;
  if (origin !== expected) throw new Error("Cross-origin form submission rejected");
}
