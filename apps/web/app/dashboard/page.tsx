import { redirect } from "next/navigation";
import { appUrl } from "@ginmap/config";
import { getEncryptedToken, getProfileSettings, getSnapshot, latestSyncStatus } from "@ginmap/db";
import { currentUser } from "../../lib/session";

function readmeEmbed(login: string): string {
  const base = appUrl();
  return `[![Ginmap](${base}/${login}.svg)](${base}/${login})`;
}

function widgetEmbed(login: string): string {
  const base = appUrl();
  return `<script type="module" src="${base}/widget.js"></script>\n<gin-map username="${login}" view="full" theme="auto"></gin-map>`;
}

function iframeEmbed(login: string): string {
  const base = appUrl();
  return `<iframe src="${base}/${login}/embed" title="${login}'s GitHub work map" loading="lazy"></iframe>`;
}

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  const [snapshot, settings, sync, encryptedToken] = await Promise.all([
    getSnapshot(user.id), getProfileSettings(user.id), latestSyncStatus(user.id), getEncryptedToken(user.id),
  ]);
  const hidden = new Set(settings.hiddenRepositoryIds);
  const pinned = new Set(settings.pinnedRepositoryIds);
  return (
    <div className="shell dashboard">
      <div className="profile-header profile-header-wide">
        <div className="profile-header">
          <img className="avatar" src={user.avatar_url} alt="" />
          <div><h1>{user.login}</h1><p>{encryptedToken ? "Profile claimed" : "Claim disconnected"} · {sync ? `${sync.kind} ${sync.status}` : "waiting for first sync"}</p></div>
        </div>
        <a className="button" href={`/${user.login}`}>View public Ginmap</a>
      </div>
      {!snapshot ? <div className="panel generation-panel"><h2>Building your Ginmap</h2><p className="muted">Ginmap is reading your public GitHub history. A failed backfill resumes from its last completed year.</p>{sync?.error_summary ? <div className="notice">{sync.error_summary}</div> : null}<form action="/api/sync" method="post"><button className="button" type="submit">Queue sync</button></form></div> : (
        <div className="dashboard-grid" style={{ marginTop: 28 }}>
          <aside className="stack">
            <section className="panel">
              <h2>Visibility</h2>
              <form action="/api/settings/profile" method="post" className="settings-list">
                <label className="setting-row"><span><strong>Public profile</strong><small>Allow anyone with the URL to view or embed your Ginmap.</small></span><input type="checkbox" name="publicProfile" defaultChecked={settings.publicProfile}/></label>
                <label className="setting-row"><span><strong>Search indexing</strong><small>Allow search engines to index your claimed personal page.</small></span><input type="checkbox" name="searchIndexing" defaultChecked={settings.searchIndexing} disabled={!settings.publicProfile}/></label>
                <button className="button" type="submit">Save visibility</button>
              </form>
            </section>
            <section className="panel"><h2>Card metrics</h2><form action="/api/settings/metrics" method="post" className="settings-list">{Object.entries(settings.visibleMetrics).map(([key, value]) => <label className="setting-row" key={key}><span>{key.replace(/([A-Z])/g," $1")}</span><input type="checkbox" name={key} defaultChecked={value}/></label>)}<button className="button" type="submit">Save metrics</button></form></section>
            <section className="panel danger-zone"><h2>Claim</h2><div className="stack">{encryptedToken ? <form action="/api/account/disconnect" method="post"><button className="button" type="submit">Disconnect claim</button></form> : <a className="button" href={`/api/auth/github/start?claim=${encodeURIComponent(user.login)}`}>Claim again</a>}<form action="/api/account/delete" method="post"><button className="button danger" type="submit">Delete Ginmap data</button></form></div></section>
          </aside>
          <div className="stack">
            <section className="panel"><h2>Use your Ginmap</h2><p className="muted">All surfaces stay on the same live work-map snapshot.</p>
              <div className="stack">
                <div><strong>GitHub README</strong><textarea className="embed" readOnly value={readmeEmbed(user.login)} aria-label="README embed" /></div>
                <div><strong>Website Web Component</strong><p className="muted">Recommended for normal websites. The component is framework-independent and isolates its styles with Shadow DOM.</p><textarea className="embed" readOnly value={widgetEmbed(user.login)} aria-label="Web Component embed" /></div>
                <div><strong>iframe fallback</strong><p className="muted">Use this when the host site cannot run the Web Component script.</p><textarea className="embed" readOnly value={iframeEmbed(user.login)} aria-label="iframe embed" /></div>
              </div>
              {settings.publicProfile ? <img className="card-preview" src={`/${user.login}.svg?theme=light`} alt="Ginmap card preview" /> : <div className="notice">Enable the public profile to render and embed Ginmap.</div>}
            </section>
            <section className="panel"><div className="section-heading"><div><h2>Work presentation</h2><p className="muted">Pin representative repositories, reorder pins, or hide noise. These choices affect the personal page, website embed, README card, and public API without changing GitHub facts.</p></div><form action="/api/sync" method="post"><button className="button" type="submit">Sync now</button></form></div>
              {snapshot.repositories.map((repository) => <div className="repo-control" key={repository.repositoryId}><div><div className="repo-title">{repository.fullName}</div><div className="repo-meta">{repository.role === "owner" ? "project" : "external"} · {repository.pullRequests} PRs · {repository.mergedPullRequests} merged · {repository.issues} issues · {repository.reviews} reviews {pinned.has(repository.repositoryId) ? "· pinned" : ""} {hidden.has(repository.repositoryId) ? "· hidden" : ""}</div></div><form className="repo-control-actions" action="/api/settings/repository" method="post"><input type="hidden" name="repositoryId" value={repository.repositoryId}/>{hidden.has(repository.repositoryId) ? <button className="button tiny" name="action" value="show">Show</button> : <button className="button tiny" name="action" value="hide">Hide</button>}{pinned.has(repository.repositoryId) ? <><button className="button tiny" name="action" value="up">↑</button><button className="button tiny" name="action" value="down">↓</button><button className="button tiny" name="action" value="unpin">Unpin</button></> : <button className="button tiny" name="action" value="pin">Pin</button>}</form></div>)}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
