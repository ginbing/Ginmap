import { NextRequest, NextResponse } from "next/server";
import { validGitHubLogin } from "@ginmap/hosted";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim() ?? "";
  if (!validGitHubLogin(username)) return NextResponse.redirect(new URL("/?lookup=invalid", request.url), 303);
  return NextResponse.redirect(new URL(`/${username}`, request.url), 303);
}
