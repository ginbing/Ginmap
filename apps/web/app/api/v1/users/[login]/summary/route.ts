import { NextRequest } from "next/server";
import { applySettings, toPublicSummary } from "@ginmap/analytics";
import { AnonymousProfileRateLimitError, ensureHostedProfile } from "@ginmap/hosted";
import { requesterKey } from "../../../../../../lib/requester";

const publicHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: publicHeaders });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  let state;
  try {
    state = await ensureHostedProfile(login, requesterKey(request.headers));
  } catch (error) {
    if (error instanceof AnonymousProfileRateLimitError) {
      return Response.json(
        { error: "rate_limited" },
        { status: 429, headers: { ...publicHeaders, "Retry-After": "60", "Cache-Control": "no-store" } },
      );
    }
    throw error;
  }
  if (!state) return Response.json({ error: "not_found" }, { status: 404, headers: publicHeaders });
  if (state.claimed && !state.settings.publicProfile) {
    return Response.json({ error: "not_found" }, { status: 404, headers: publicHeaders });
  }
  if (!state.snapshot) {
    return Response.json(
      { status: "building", login: state.user.login },
      { status: 202, headers: { ...publicHeaders, "Cache-Control": "no-store", "Retry-After": "3" } },
    );
  }
  const snapshot = applySettings(state.snapshot, state.settings);
  const response = toPublicSummary(snapshot, "https://github.com/ginbing/Ginmap/blob/main/docs/METRICS.md");
  return Response.json(response, {
    headers: {
      ...publicHeaders,
      "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
    },
  });
}
