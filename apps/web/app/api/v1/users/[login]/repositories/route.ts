import { applySettings, splitWork } from "@ginmap/analytics";
import { ensureHostedProfile } from "@ginmap/hosted";

export async function GET(_request: Request, { params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const state = await ensureHostedProfile(login);
  if (!state) return Response.json({ error: "not_found" }, { status: 404 });
  if (state.claimed && !state.settings.publicProfile) return Response.json({ error: "not_found" }, { status: 404 });
  if (!state.snapshot) {
    return Response.json({ status: "building", login: state.user.login }, { status: 202, headers: { "Cache-Control": "no-store", "Retry-After": "3" } });
  }
  const snapshot = applySettings(state.snapshot, state.settings);
  const { projects, externalContributions } = splitWork(snapshot.repositories);
  return Response.json(
    { schemaVersion: snapshot.schemaVersion, calculatedAt: snapshot.calculatedAt, projects, externalContributions, repositories: snapshot.repositories },
    { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=3600" } },
  );
}
