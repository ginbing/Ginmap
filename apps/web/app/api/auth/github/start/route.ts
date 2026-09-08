import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appUrl, createOAuthState, githubClientId } from "@ginmap/config";
import { OAUTH_STATE_COOKIE } from "../../../../../lib/session";

export async function GET() {
  const state = createOAuthState();
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl().startsWith("https://"),
    path: "/",
    maxAge: 600,
  });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", githubClientId());
  url.searchParams.set("redirect_uri", `${appUrl()}/api/auth/github/callback`);
  url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
