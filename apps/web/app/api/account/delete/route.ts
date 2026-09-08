import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { optOutAndDeleteUser } from "@ginmap/db";
import { currentUser, SESSION_COOKIE } from "../../../../lib/session";
import { requireSameOrigin } from "../../../../lib/security";

export async function POST(request: NextRequest) {
  requireSameOrigin(request);
  const user = await currentUser();
  if (user) await optOutAndDeleteUser(user.id);
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL("/", request.url), 303);
}
