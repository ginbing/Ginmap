import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AnonymousProfileRateLimitError, ensureHostedProfile, getRepositoryEvidence } from "@ginmap/hosted";
import { requesterKey } from "../../../../../../lib/requester";

function n(value: number): string { return new Intl.NumberFormat("en").format(value); }

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function RepositoryWorkPage({ params }: { params: Promise<{ login: string; owner: string; repo: string }> }) {
  const { login, owner, repo } = await params;
  let state;
  try {
    state = await ensureHostedProfile(login, requesterKey(await headers()));
  } catch (error) {
    if (error instanceof AnonymousProfileRateLimitError) redirect(`/${login}`);
    throw error;
  }
  if (!state) notFound();
  if (state.user.login.toLowerCase() !== login.toLowerCase()) redirect(`/${state.user.login}/repositories/${owner}/${repo}`);
  if (state.claimed && !state.settings.publicProfile) notFound();
  if (!state.snapshot) redirect(`/${state.user.login}`);

  const evidence = await getRepositoryEvidence(state.user.id, owner, repo);
  if (!evidence || state.settings.hiddenRepositoryIds.includes(evidence.repository.repositoryId)) notFound();
  const r = evidence.repository;
  const role = r.role === "owner" ? (r.isFork ? "Fork" : "Project") : "External contribution";
  const activity = r.firstActivityAt || r.lastActivityAt
    ? `${r.firstActivityAt ? new Date(r.firstActivityAt).toLocaleDateString("en-US") : "—"} to ${r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleDateString("en-US") : "—"}`
    : r.firstActivityYear != null
      ? `${r.firstActivityYear}${r.lastActivityYear && r.lastActivityYear !== r.firstActivityYear ? `–${r.lastActivityYear}` : ""}`
      : "—";
  return (
    <div className="shell profile">
      <div className="breadcrumb"><a href={`/${state.user.login}`}>{state.user.login}</a><span>/</span><span>{r.fullName}</span></div>
      <div className="profile-header profile-header-wide">
        <div>
          <div className="eyebrow">{role}</div>
          <h1 className="repo-detail-title">{r.fullName}</h1>
          {r.description ? <p>{r.description}</p> : <p className="muted">Work by {state.user.login} in this public repository.</p>}
        </div>
        <a className="button" href={r.htmlUrl}>Repository ↗</a>
      </div>

      <div className="summary-grid repo-summary-grid">
        <div className="metric-card"><strong>{n(r.pullRequests)}</strong><span>authored PRs</span></div>
        <div className="metric-card"><strong>{n(r.mergedPullRequests)}</strong><span>merged</span></div>
        <div className="metric-card"><strong>{n(r.issues)}</strong><span>issues</span></div>
        <div className="metric-card"><strong>{n(r.reviews)}</strong><span>reviewed PRs</span></div>
        <div className="metric-card"><strong>{n(r.additions)}</strong><span>PR additions</span></div>
        <div className="metric-card"><strong>{n(r.deletions)}</strong><span>PR deletions</span></div>
      </div>

      <div className="profile-grid lower-profile-grid">
        <section className="panel">
          <h2>Pull requests</h2>
          <div className="evidence-list">
            {evidence.pullRequests.map((pr) => (
              <a className="evidence-row" href={pr.url} key={pr.number}>
                <div><strong>#{pr.number} {pr.title}</strong><span className={`state-pill ${pr.merged ? "merged" : pr.state.toLowerCase()}`}>{pr.merged ? "merged" : pr.state.toLowerCase()}</span></div>
                <div className="repo-meta">+{n(pr.additions)} / -{n(pr.deletions)} · {n(pr.changedFiles)} files · {new Date(pr.createdAt).toLocaleDateString("en-US")}</div>
              </a>
            ))}
            {evidence.pullRequests.length === 0 ? <div className="empty">No authored pull requests recorded.</div> : null}
          </div>
        </section>
        <aside className="stack">
          <section className="panel"><h2>Issues</h2><div className="evidence-list">{evidence.issues.map((issue) => <a className="evidence-row" href={issue.url} key={issue.number}><div><strong>#{issue.number} {issue.title}</strong><span className={`state-pill ${issue.state.toLowerCase()}`}>{issue.state.toLowerCase()}</span></div><div className="repo-meta">Opened {new Date(issue.createdAt).toLocaleDateString("en-US")}</div></a>)}{evidence.issues.length === 0 ? <div className="empty">No authored issues recorded.</div> : null}</div></section>
          <section className="panel"><h2>Context</h2><p className="muted">{r.primaryLanguage ? `${r.primaryLanguage} · ` : ""}★ {n(r.stars)} · {n(r.commits)} GitHub-counted commits · active {activity}.</p><p className="muted">Ginmap reports GitHub evidence. It does not infer maintainership, employment, or project membership.</p></section>
        </aside>
      </div>
    </div>
  );
}
