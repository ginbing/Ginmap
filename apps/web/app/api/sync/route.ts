import { NextRequest, NextResponse } from "next/server";
import { enqueueSync, getEncryptedToken, getSnapshot } from "@ginmap/db";
import { currentUser } from "../../../lib/session";
import { isSameOrigin } from "../../../lib/security";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url), 303);
  const [snapshot, token] = await Promise.all([getSnapshot(user.id), getEncryptedToken(user.id)]);
  if (!token) return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  await enqueueSync(user.id, snapshot ? "incremental" : "backfill");
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
