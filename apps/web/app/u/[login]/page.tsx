import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { splitWork } from "@ginmap/analytics";
import { ensureHostedProfile } from "@ginmap/hosted";
import { applySettings } from "@ginmap/analytics";
import { GeneratingProfile } from "./GeneratingProfile";

function n(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

function repoHref(login: string, fullName: string): string {
  const [owner, repo] = fullName.split("/");
  return `/${login}/repositories/${encodeURIComponent(owner ?? "")}/${encodeURIComponent(repo ?? "")}`;
}

export async function generateMetadata({ params }: { params: Promise<{ login: string }> }): Promise<Metadata> {
  const { login } = await params;
  const state = await ensureHostedProfile(login);
  if (!state) return { title: "GitHub profile", robots: { index: false, follow: false } };
  const index = state.claimed && state.settings.searchIndexing && state.settings.publicProfile;
  return {
    title: `${state.user.login}'s GitHub work`,
    description: `A Ginmap summary of ${state.user.login}'s public GitHub work.`,
    robots: { index, follow: index },
    alternates: { canonical: `/${state.user.login}` },
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const state = await ensureHostedProfile(login);
  if (!state) notFound();
  if (state.user.login.toLowerCase() !== login.toLowerCase()) redirect(`/${state.user.login}`);
  if (state.claimed && !state.settings.publicProfile) notFound();

  if (!state.snapshot) {
    return (
      <div className="shell profile">
        <div className="profile-header">
          <img className="avatar" src={state.user.avatar_url} alt="" />
          <div><h1>{state.user.login}</h1><p>Building a lifetime public GitHub work map</p></div>
        </div>
        <section className="panel generation-panel">
          <h2>Building this Ginmap</h2>
          <GeneratingProfile />
          {state.sync?.error_summary ? <div className="notice">The last attempt failed and has been queued for retry.</div> : null}
        </section>
      </div>
    );
  }

  const snapshot = applySettings(state.snapshot, state.settings);
  const { projects, externalContributions } = splitWork(snapshot.repositories);
  const maxYear = Math.max(1, ...snapshot.years.map((year) => year.contributions));
  const claimUrl = `/api/auth/github/start?claim=${encodeURIComponent(snapshot.identity.login)}`;

  const repoRows = (repositories: typeof snapshot.repositories) => (
    <div className="repo-list">
      {repositories.map((repository) => (
        <a className="repo-card" href={repoHref(snapshot.identity.login, repository.fullName)} key={repository.repositoryId}>
          <div className="repo-id">
            {repository.ownerAvatarUrl ? <img className="repo-avatar" src={repository.ownerAvatarUrl} alt="" /> : null}
            <div>
              <div className="repo-title">{repository.fullName}</div>
              <div className="repo-meta">★ {n(repository.stars)} · {repository.commitDays} GitHub-counted commit days · {repository.reviews} reviews</div>
            </div>
          </div>
          <div className="repo-stats"><div>{repository.pullRequests} PRs · <strong>{repository.mergedPullRequests} merged</strong></div><div className="repo-meta">{repository.issues} issues · {repository.openPullRequests} open</div></div>
        </a>
      ))}
      {repositories.length === 0 ? <div className="empty">No public repository work in this category.</div> : null}
    </div>
  );

  return (
    <div className="shell profile">
      <div className="profile-header profile-header-wide">
        <div className="profile-header">
          <img className="avatar" src={snapshot.identity.avatarUrl} alt="" />
          <div><h1>{snapshot.identity.login}</h1><p>Lifetime public GitHub work · calculated {new Date(snapshot.calculatedAt).toLocaleDateString("en-US")}</p></div>
        </div>
        <div className="actions compact-actions">
          <a className="button" href={snapshot.identity.profileUrl}>GitHub ↗</a>
          {!state.claimed ? <a className="button primary" href={claimUrl}>Claim this Ginmap</a> : null}
        </div>
      </div>

      <div className="summary-grid">
        <div className="metric-card"><strong>{n(snapshot.lifetime.pullRequests)}</strong><span>authored PRs</span></div>
        <div className="metric-card"><strong>{n(snapshot.lifetime.mergedPullRequests)}</strong><span>merged PRs</span></div>
        <div className="metric-card"><strong>{n(snapshot.lifetime.issues)}</strong><span>authored issues</span></div>
        <div className="metric-card"><strong>{n(snapshot.lifetime.reviews)}</strong><span>reviews</span></div>
        <div className="metric-card"><strong>{n(snapshot.lifetime.repositoriesWorkedIn)}</strong><span>repositories</span></div>
        <div className="metric-card"><strong>{n(snapshot.lifetime.contributions)}</strong><span>public contributions</span></div>
      </div>

      <div className="work-sections">
        <section className="panel">
          <div className="section-heading"><div><div className="eyebrow">What they built</div><h2>Projects</h2></div><span className="status">{projects.length}</span></div>
          {repoRows(projects)}
        </section>
        <section className="panel">
          <div className="section-heading"><div><div className="eyebrow">Work in other repositories</div><h2>External contributions</h2></div><span className="status">{externalContributions.length}</span></div>
          {repoRows(externalContributions)}
        </section>
      </div>

      <div className="profile-grid lower-profile-grid">
        <section className="panel"><h2>By year</h2><div className="year-list">{[...snapshot.years].reverse().map((year) => <div className="year-row" key={year.year}><span>{year.year}</span><div className="bar"><span style={{ width: `${Math.max(2, year.contributions / maxYear * 100)}%` }} /></div><strong>{n(year.contributions)}</strong></div>)}</div></section>
        <aside className="stack">
          <section className="panel"><h2>Code changed through authored PRs</h2><div className="code-change"><strong className="plus">+{n(snapshot.lifetime.additions)}</strong> <span className="muted">/</span> <strong className="minus">-{n(snapshot.lifetime.deletions)}</strong></div><p className="muted">Across {n(snapshot.lifetime.changedFiles)} changed files. Diff totals can include generated files, lockfiles, formatting, and deletions; they are not “lines written.”</p></section>
          <section className="panel"><h2>Data</h2><p className="muted">Ginmap summarizes public GitHub API data. It does not infer employment, maintainer status, or developer quality.</p><a href="https://github.com/ginbing/Ginmap/blob/main/docs/METRICS.md">Metric definitions →</a></section>
        </aside>
      </div>
    </div>
  );
}
