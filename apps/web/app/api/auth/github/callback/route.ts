import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  appUrl,
  createSessionToken,
  encryptToken,
  githubClientId,
  githubClientSecret,
} from "@ginmap/config";
import { connectGitHubAccount, enqueueSync, upsertUser } from "@ginmap/db";
import { exchangeOAuthCode, fetchViewerIdentity } from "@ginmap/github";
import { OAUTH_STATE_COOKIE, SESSION_COOKIE } from "../../../../../lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth=failed", appUrl()));
  }
  try {
    const oauth = await exchangeOAuthCode(githubClientId(), githubClientSecret(), code);
    if (oauth.scope.trim() !== "") throw new Error("Ginmap requires a public-data-only GitHub authorization");
    const identity = await fetchViewerIdentity(oauth.accessToken);
    const user = await upsertUser(identity);
    const now = Date.now();
    await connectGitHubAccount(user.id, {
      tokenCiphertext: encryptToken(oauth.accessToken),
      refreshTokenCiphertext: oauth.refreshToken ? encryptToken(oauth.refreshToken) : null,
      tokenExpiresAt: oauth.expiresIn == null ? null : new Date(now + oauth.expiresIn * 1000),
      refreshTokenExpiresAt: oauth.refreshTokenExpiresIn == null ? null : new Date(now + oauth.refreshTokenExpiresIn * 1000),
      scopes: oauth.scope,
    });
    await enqueueSync(user.id, "backfill");
    cookieStore.set(SESSION_COOKIE, createSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl().startsWith("https://"),
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return NextResponse.redirect(new URL("/dashboard", appUrl()));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/?auth=failed", appUrl()));
  }
}
