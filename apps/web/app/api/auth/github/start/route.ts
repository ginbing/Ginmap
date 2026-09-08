import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appUrl, createOAuthState, githubClientId } from "@ginmap/config";
import { validGitHubLogin } from "@ginmap/hosted";
import { CLAIM_LOGIN_COOKIE, OAUTH_STATE_COOKIE } from "../../../../../lib/session";

export async function GET(request: NextRequest) {
  const state = createOAuthState();
  const claim = request.nextUrl.searchParams.get("claim")?.trim() ?? "";
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: appUrl().startsWith("https://"),
    path: "/",
    maxAge: 600,
  };
  cookieStore.set(OAUTH_STATE_COOKIE, state, options);
  if (validGitHubLogin(claim)) cookieStore.set(CLAIM_LOGIN_COOKIE, claim, options);
  else cookieStore.delete(CLAIM_LOGIN_COOKIE);

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", githubClientId());
  url.searchParams.set("redirect_uri", `${appUrl()}/api/auth/github/callback`);
  url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}
