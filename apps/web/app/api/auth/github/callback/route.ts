import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  appUrl,
  createSessionToken,
  encryptToken,
  githubClientId,
  githubClientSecret,
} from "@ginmap/config";
import { connectGitHubAccount, enqueueSync, getSnapshot, getUserByLogin, upsertUser } from "@ginmap/db";
import { exchangeOAuthCode, fetchViewerIdentity } from "@ginmap/github";
import { CLAIM_LOGIN_COOKIE, OAUTH_STATE_COOKIE, SESSION_COOKIE } from "../../../../../lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const claimLogin = cookieStore.get(CLAIM_LOGIN_COOKIE)?.value ?? null;
  cookieStore.delete(OAUTH_STATE_COOKIE);
  cookieStore.delete(CLAIM_LOGIN_COOKIE);
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth=failed", appUrl()));
  }
  try {
    const oauth = await exchangeOAuthCode(githubClientId(), githubClientSecret(), code);
    if (oauth.scope.trim() !== "") throw new Error("Ginmap requires a public-data-only GitHub authorization");
    const identity = await fetchViewerIdentity(oauth.accessToken);
    const target = claimLogin ? await getUserByLogin(claimLogin) : null;
    if (claimLogin && target && target.github_id !== identity.githubId) {
      return NextResponse.redirect(new URL(`/${encodeURIComponent(claimLogin)}?claim=wrong-account`, appUrl()));
    }
    if (claimLogin && !target && identity.login.toLowerCase() !== claimLogin.toLowerCase()) {
      return NextResponse.redirect(new URL(`/${encodeURIComponent(claimLogin)}?claim=wrong-account`, appUrl()));
    }
    const user = await upsertUser(identity);
    const now = Date.now();
    await connectGitHubAccount(user.id, {
      tokenCiphertext: encryptToken(oauth.accessToken),
      refreshTokenCiphertext: oauth.refreshToken ? encryptToken(oauth.refreshToken) : null,
      tokenExpiresAt: oauth.expiresIn == null ? null : new Date(now + oauth.expiresIn * 1000),
      refreshTokenExpiresAt: oauth.refreshTokenExpiresIn == null ? null : new Date(now + oauth.refreshTokenExpiresIn * 1000),
      scopes: oauth.scope,
    });
    await enqueueSync(user.id, (await getSnapshot(user.id)) ? "incremental" : "backfill");
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
