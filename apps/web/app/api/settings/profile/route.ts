import { NextRequest, NextResponse } from "next/server";
import { getProfileSettings, saveProfileSettings } from "@ginmap/db";
import { currentUser } from "../../../../lib/session";
import { requireSameOrigin } from "../../../../lib/security";

export async function POST(request: NextRequest) {
  requireSameOrigin(request);
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url), 303);
  const form = await request.formData();
  const settings = await getProfileSettings(user.id);
  settings.publicProfile = form.get("publicProfile") === "true";
  await saveProfileSettings(user.id, settings);
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
