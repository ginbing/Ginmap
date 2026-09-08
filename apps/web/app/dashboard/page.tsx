import { redirect } from "next/navigation";
import { appUrl } from "@ginmap/config";
import { getEncryptedToken, getProfileSettings, getSnapshot, latestSyncStatus } from "@ginmap/db";
import { currentUser } from "../../lib/session";

function embed(login: string): string {
  const base = appUrl();
  return `<a href="${base}/u/${login}">\n  <picture>\n    <source media="(prefers-color-scheme: dark)" srcset="${base}/u/${login}/card.svg?theme=dark">\n    <img alt="${login}'s GitHub work summary" src="${base}/u/${login}/card.svg?theme=light">\n  </picture>\n</a>`;
}

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) { redirect("/"); throw new Error("unreachable"); }
  const [snapshot, settings, sync, encryptedToken] = await Promise.all([
    getSnapshot(user.id), getProfileSettings(user.id), latestSyncStatus(user.id), getEncryptedToken(user.id),
  ]);
  const hidden = new Set(settings.hiddenRepositoryIds);
  const pinned = new Set(settings.pinnedRepositoryIds);
  return (
    <div className="shell dashboard">
      <div className="profile-header">
        <img className="avatar" src={user.avatar_url} alt="" />
        <div><h1>{user.login}</h1><p>{encryptedToken ? "GitHub connected" : "GitHub disconnected"} · {sync ? `${sync.kind} ${sync.status}` : "waiting for first sync"}</p></div>
      </div>
      {!snapshot ? <div className="panel" style={{ marginTop: 28 }}><h2>Building your Ginmap</h2><p className="muted">The worker is reading your public GitHub history year by year. A failed backfill resumes from its last completed year.</p>{sync?.error_summary ? <div className="notice">{sync.error_summary}</div> : null}<form action="/api/sync" method="post"><button className="button" type="submit">Queue sync</button></form></div> : (
        <div className="dashboard-grid" style={{ marginTop: 28 }}>
          <aside className="stack">
            <section className="panel"><h2>Public profile</h2><p className="muted">{settings.publicProfile ? "Your Ginmap profile and card are public." : "Your public profile and card are disabled."}</p><form action="/api/settings/profile" method="post"><input type="hidden" name="publicProfile" value={settings.publicProfile ? "false" : "true"}/><button className="button" type="submit">{settings.publicProfile ? "Disable public profile" : "Enable public profile"}</button></form></section>
            <section className="panel"><h2>Card metrics</h2><form action="/api/settings/metrics" method="post" className="settings-list">{Object.entries(settings.visibleMetrics).map(([key, value]) => <label className="setting-row" key={key}><span>{key.replace(/([A-Z])/g," $1")}</span><input type="checkbox" name={key} defaultChecked={value}/></label>)}<button className="button" type="submit">Save metrics</button></form></section>
            <section className="panel danger-zone"><h2>Account</h2><div className="stack">{encryptedToken ? <form action="/api/account/disconnect" method="post"><button className="button" type="submit">Disconnect GitHub</button></form> : <a className="button" href="/api/auth/github/start">Reconnect GitHub</a>}<form action="/api/account/delete" method="post"><button className="button danger" type="submit">Delete Ginmap data</button></form></div></section>
          </aside>
          <div className="stack">
            <section className="panel"><h2>README card</h2><p className="muted">Paste this once. Ginmap updates the image behind the stable URL.</p>{settings.publicProfile ? <img className="card-preview" src={`/u/${user.login}/card.svg?theme=light`} alt="Ginmap card preview" /> : <div className="notice">Enable the public profile to render the card.</div>}<textarea className="embed" readOnly value={embed(user.login)} aria-label="README embed" /></section>
            <section className="panel"><div style={{ display:"flex", justifyContent:"space-between", gap:16, alignItems:"center" }}><div><h2>Repository work map</h2><p className="muted">Pin representative repositories, reorder pins, or hide noise. Hidden repositories are also removed from the public JSON API.</p></div><form action="/api/sync" method="post"><button className="button" type="submit">Sync now</button></form></div>
              {snapshot.repositories.map((repository) => <div className="repo-control" key={repository.repositoryId}><div><div className="repo-title">{repository.fullName}</div><div className="repo-meta">{repository.pullRequests} PRs · {repository.mergedPullRequests} merged · {repository.issues} issues · {repository.reviews} reviews {pinned.has(repository.repositoryId) ? "· pinned" : ""} {hidden.has(repository.repositoryId) ? "· hidden" : ""}</div></div><form className="repo-control-actions" action="/api/settings/repository" method="post"><input type="hidden" name="repositoryId" value={repository.repositoryId}/>{hidden.has(repository.repositoryId) ? <button className="button tiny" name="action" value="show">Show</button> : <button className="button tiny" name="action" value="hide">Hide</button>}{pinned.has(repository.repositoryId) ? <><button className="button tiny" name="action" value="up">↑</button><button className="button tiny" name="action" value="down">↓</button><button className="button tiny" name="action" value="unpin">Unpin</button></> : <button className="button tiny" name="action" value="pin">Pin</button>}</form></div>)}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
