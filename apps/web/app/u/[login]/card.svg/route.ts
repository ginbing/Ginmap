import { NextRequest } from "next/server";
import { getUserByLogin } from "@ginmap/db";
import { getVisibleSnapshot } from "@ginmap/analytics";
import { renderWorkCard } from "@ginmap/render";
import type { Theme } from "@ginmap/model";

export async function GET(request: NextRequest, { params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const user = await getUserByLogin(login);
  if (!user) return new Response("Not found", { status: 404 });
  const visible = await getVisibleSnapshot(user.id);
  if (!visible || !visible.settings.publicProfile) return new Response("Not found", { status: 404 });
  const theme: Theme = request.nextUrl.searchParams.get("theme") === "dark" ? "dark" : "light";
  const svg = renderWorkCard(visible.snapshot, visible.settings, theme);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
