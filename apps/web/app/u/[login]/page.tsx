import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUserByLogin } from "@ginmap/db";
import { getVisibleSnapshot } from "@ginmap/analytics";

function n(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

export async function generateMetadata({ params }: { params: Promise<{ login: string }> }): Promise<Metadata> {
  const { login } = await params;
  return { title: `${login}'s GitHub work`, description: `A Ginmap summary of ${login}'s public GitHub work.` };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const user = await getUserByLogin(login);
  if (!user) { notFound(); throw new Error("unreachable"); }
  if (user.login.toLowerCase() !== login.toLowerCase()) redirect(`/u/${user.login}`);
  const visible = await getVisibleSnapshot(user.id);
  if (!visible || !visible.settings.publicProfile) { notFound(); throw new Error("unreachable"); }
  const { snapshot } = visible;
  const maxYear = Math.max(1, ...snapshot.years.map((year) => year.contributions));
  return (
    <div className="shell profile">
      <div className="profile-header">
        <img className="avatar" src={snapshot.identity.avatarUrl} alt="" />
        <div><h1>{snapshot.identity.login}</h1><p>Lifetime public GitHub work · calculated {new Date(snapshot.calculatedAt).toLocaleDateString("en-US")}</p></div>
      </div>
      <div className="summary-grid">
        <div className="metric-card"><strong>{n(snapshot.lifetime.pullRequests)}</strong><span>authored PRs</span></div>
        <div className="metric-card"><strong>{n(snapshot.lifetime.mergedPullRequests)}</strong><span>merged PRs</span></div>
        <div className="metric-card"><strong>{n(snapshot.lifetime.issues)}</strong><span>authored issues</span></div>
        <div className="metric-card"><strong>{n(snapshot.lifetime.reviews)}</strong><span>reviews</span></div>
        <div className="metric-card"><strong>{n(snapshot.lifetime.repositoriesWorkedIn)}</strong><span>repositories</span></div>
        <div className="metric-card"><strong>{n(snapshot.lifetime.contributions)}</strong><span>public contributions</span></div>
      </div>
      <div className="profile-grid">
        <section className="panel">
          <h2>Repository work map</h2>
          <div className="repo-list">
            {snapshot.repositories.map((repository) => (
              <a className="repo-card" href={repository.htmlUrl} key={repository.repositoryId}>
                <div className="repo-id">
                  {repository.ownerAvatarUrl ? <img className="repo-avatar" src={repository.ownerAvatarUrl} alt="" /> : null}
                  <div><div className="repo-title">{repository.fullName}</div><div className="repo-meta">{repository.role} · ★ {n(repository.stars)} · {repository.commitDays} GitHub-counted commit days · {repository.reviews} reviews</div></div>
                </div>
                <div className="repo-stats"><div>{repository.pullRequests} PRs · <strong>{repository.mergedPullRequests} merged</strong></div><div className="repo-meta">{repository.issues} issues · {repository.openPullRequests} open</div></div>
              </a>
            ))}
            {snapshot.repositories.length === 0 ? <div className="empty">No visible repository work yet.</div> : null}
          </div>
        </section>
        <aside className="stack">
          <section className="panel"><h2>Code changed through authored PRs</h2><div className="code-change"><strong className="plus">+{n(snapshot.lifetime.additions)}</strong> <span className="muted">/</span> <strong className="minus">-{n(snapshot.lifetime.deletions)}</strong></div><p className="muted">Across {n(snapshot.lifetime.changedFiles)} changed files. Diff totals can include generated files, lockfiles, formatting, and deletions; they are not “lines written.”</p></section>
          <section className="panel"><h2>By year</h2><div className="year-list">{[...snapshot.years].reverse().map((year) => <div className="year-row" key={year.year}><span>{year.year}</span><div className="bar"><span style={{ width: `${Math.max(2, year.contributions / maxYear * 100)}%` }} /></div><strong>{n(year.contributions)}</strong></div>)}</div></section>
          <section className="panel"><h2>Data</h2><p className="muted">Metrics are derived from public GitHub API data and use documented definitions. Ginmap does not infer employment, maintainer status, or developer quality.</p><a href="https://github.com/ginbing/Ginmap/blob/main/docs/METRICS.md">Metric definitions →</a></section>
        </aside>
      </div>
    </div>
  );
}
