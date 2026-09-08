import type { NextRequest } from "next/server";
import { appUrl } from "@ginmap/config";

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(appUrl()).origin) return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || fetchSite === "same-origin";
}
