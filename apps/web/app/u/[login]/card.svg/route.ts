import { NextRequest } from "next/server";
import { applySettings } from "@ginmap/analytics";
import { AnonymousProfileRateLimitError, ensureHostedProfile } from "@ginmap/hosted";
import { escapeXml, renderWorkCard } from "@ginmap/render";
import type { Theme } from "@ginmap/model";
import { requesterKey } from "../../../../lib/requester";

function pendingCard(login: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="150" viewBox="0 0 760 150" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(login)} Ginmap is being built</title>
<desc id="desc">Ginmap is reading this account's public GitHub history.</desc>
<rect x="0.5" y="0.5" width="759" height="149" rx="12" fill="#ffffff" stroke="#d0d7de"/>
<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}</style>
<text x="28" y="48" font-size="22" font-weight="700" fill="#1f2328">${escapeXml(login)}</text>
<text x="28" y="78" font-size="14" fill="#636c76">Building a lifetime public GitHub work map…</text>
<text x="732" y="48" text-anchor="end" font-size="13" font-weight="600" fill="#0969da">Ginmap</text>
</svg>`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  let state;
  try {
    state = await ensureHostedProfile(login, requesterKey(request.headers));
  } catch (error) {
    if (error instanceof AnonymousProfileRateLimitError) return new Response("Too many uncached profiles", { status: 429, headers: { "Retry-After": "60" } });
    throw error;
  }
  if (!state) return new Response("Not found", { status: 404 });
  if (state.claimed && !state.settings.publicProfile) return new Response("Not found", { status: 404 });
  const theme: Theme = request.nextUrl.searchParams.get("theme") === "dark" ? "dark" : "light";
  const svg = state.snapshot ? renderWorkCard(applySettings(state.snapshot, state.settings), state.settings, theme) : pendingCard(state.user.login);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
