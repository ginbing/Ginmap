import { getUserByLogin } from "@ginmap/db";
import { getVisibleSnapshot } from "@ginmap/analytics";

export async function GET(_request: Request, { params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const user = await getUserByLogin(login);
  if (!user) return Response.json({ error: "not_found" }, { status: 404 });
  const visible = await getVisibleSnapshot(user.id);
  if (!visible || !visible.settings.publicProfile) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ schemaVersion: visible.snapshot.schemaVersion, calculatedAt: visible.snapshot.calculatedAt, repositories: visible.snapshot.repositories }, { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=3600" } });
}
