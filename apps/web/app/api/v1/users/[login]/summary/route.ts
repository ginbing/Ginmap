import { NextRequest } from "next/server";
import { getUserByLogin } from "@ginmap/db";
import { getVisibleSnapshot, toPublicSummary } from "@ginmap/analytics";

export async function GET(request: NextRequest, { params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const user = await getUserByLogin(login);
  if (!user) return Response.json({ error: "not_found" }, { status: 404 });
  const visible = await getVisibleSnapshot(user.id);
  if (!visible || !visible.settings.publicProfile) return Response.json({ error: "not_found" }, { status: 404 });
  const response = toPublicSummary(visible.snapshot, "https://github.com/ginbing/Ginmap/blob/main/docs/METRICS.md");
  return Response.json(response, { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=3600" } });
}
