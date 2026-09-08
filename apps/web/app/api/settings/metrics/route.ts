import { NextRequest, NextResponse } from "next/server";
import { getProfileSettings, saveProfileSettings } from "@ginmap/db";
import { currentUser } from "../../../../lib/session";
import { isSameOrigin } from "../../../../lib/security";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url), 303);
  const form = await request.formData();
  const settings = await getProfileSettings(user.id);
  for (const key of Object.keys(settings.visibleMetrics) as Array<keyof typeof settings.visibleMetrics>) {
    settings.visibleMetrics[key] = form.get(key) === "on";
  }
  await saveProfileSettings(user.id, settings);
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
