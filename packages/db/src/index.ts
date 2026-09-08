import pg from "pg";
import { databaseUrl } from "@ginmap/config";
import {
  defaultProfileSettings,
  type BackfillState,
  type GitHubIdentity,
  type IssueRecord,
  type ProfileSettings,
  type ProfileSnapshot,
  type PullRequestRecord,
  type RepositoryIdentity,
  type RepositoryWorkSummary,
  type SyncKind,
  type YearContributionRecord,
} from "@ginmap/model";

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) pool = new pg.Pool({ connectionString: databaseUrl(), max: 10 });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}

export interface UserRow {
  id: string;
  github_id: string;
  github_node_id: string | null;
  login: string;
  avatar_url: string;
  profile_url: string;
  github_created_at: Date;
  public_profile: boolean;
  owner_verified_at: Date | null;
  opted_out_at: Date | null;
  session_version: number;
}

export async function upsertUser(identity: GitHubIdentity): Promise<UserRow> {
  const db = getPool();
  const previous = await db.query<UserRow>("SELECT * FROM users WHERE github_id=$1", [identity.githubId]);
  const oldLogin = previous.rows[0]?.login;
  const result = await db.query<UserRow>(
    `INSERT INTO users (github_id,github_node_id,login,avatar_url,profile_url,github_created_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (github_id) DO UPDATE SET
       github_node_id=EXCLUDED.github_node_id, login=EXCLUDED.login, avatar_url=EXCLUDED.avatar_url,
       profile_url=EXCLUDED.profile_url, github_created_at=EXCLUDED.github_created_at, updated_at=now()
     RETURNING *`,
    [identity.githubId, identity.nodeId, identity.login, identity.avatarUrl, identity.profileUrl, identity.createdAt],
  );
  const user = result.rows[0];
  if (!user) throw new Error("Failed to upsert user");
  if (oldLogin && oldLogin.toLowerCase() !== identity.login.toLowerCase()) {
    await db.query(
      `INSERT INTO github_login_aliases (github_id,login,user_id) VALUES ($1,$2,$3)
       ON CONFLICT (login) DO UPDATE SET github_id=EXCLUDED.github_id,user_id=EXCLUDED.user_id`,
      [identity.githubId, oldLogin, user.id],
    );
  }
  await db.query(
    `INSERT INTO profile_settings (user_id,settings) VALUES ($1,$2::jsonb)
     ON CONFLICT (user_id) DO NOTHING`,
    [user.id, JSON.stringify(defaultProfileSettings)],
  );
  return user;
}

export interface StoredGitHubCredential {
  tokenCiphertext: string;
  refreshTokenCiphertext: string | null;
  tokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scopes: string;
}

export async function connectGitHubAccount(userId: string, credential: StoredGitHubCredential): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO github_accounts (user_id,token_ciphertext,refresh_token_ciphertext,token_expires_at,refresh_token_expires_at,scopes,connected_at,disconnected_at)
     VALUES ($1,$2,$3,$4,$5,$6,now(),NULL)
     ON CONFLICT (user_id) DO UPDATE SET
       token_ciphertext=EXCLUDED.token_ciphertext, refresh_token_ciphertext=EXCLUDED.refresh_token_ciphertext,
       token_expires_at=EXCLUDED.token_expires_at, refresh_token_expires_at=EXCLUDED.refresh_token_expires_at,
       scopes=EXCLUDED.scopes, connected_at=now(), disconnected_at=NULL`,
    [userId, credential.tokenCiphertext, credential.refreshTokenCiphertext, credential.tokenExpiresAt, credential.refreshTokenExpiresAt, credential.scopes],
  );
  await db.query("UPDATE users SET owner_verified_at=COALESCE(owner_verified_at,now()), opted_out_at=NULL, updated_at=now() WHERE id=$1", [userId]);
  const user = await getUserById(userId);
  if (user) await db.query("DELETE FROM profile_opt_outs WHERE github_id=$1", [user.github_id]);
}

export async function getGitHubCredential(userId: string): Promise<StoredGitHubCredential | null> {
  const result = await getPool().query<{
    token_ciphertext: string | null; refresh_token_ciphertext: string | null; token_expires_at: Date | null; refresh_token_expires_at: Date | null; scopes: string;
  }>("SELECT token_ciphertext,refresh_token_ciphertext,token_expires_at,refresh_token_expires_at,scopes FROM github_accounts WHERE user_id=$1 AND disconnected_at IS NULL", [userId]);
  const row = result.rows[0];
  if (!row?.token_ciphertext) return null;
  return {
    tokenCiphertext: row.token_ciphertext,
    refreshTokenCiphertext: row.refresh_token_ciphertext,
    tokenExpiresAt: row.token_expires_at,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
    scopes: row.scopes,
  };
}

export async function getEncryptedToken(userId: string): Promise<string | null> {
  const result = await getPool().query<{ token_ciphertext: string | null }>("SELECT token_ciphertext FROM github_accounts WHERE user_id=$1 AND disconnected_at IS NULL", [userId]);
  return result.rows[0]?.token_ciphertext ?? null;
}

export async function disconnectGitHubAccount(userId: string): Promise<void> {
  const db = getPool();
  await db.query(
    "UPDATE github_accounts SET token_ciphertext=NULL,refresh_token_ciphertext=NULL,token_expires_at=NULL,refresh_token_expires_at=NULL,disconnected_at=now() WHERE user_id=$1",
    [userId],
  );
  await db.query("UPDATE users SET session_version=session_version+1,updated_at=now() WHERE id=$1", [userId]);
  await db.query("UPDATE sync_jobs SET status='failed',last_error='GitHub disconnected',updated_at=now() WHERE user_id=$1 AND status='pending'", [userId]);
}

export async function optOutAndDeleteUser(userId: string): Promise<void> {
  const db = getPool();
  const user = await getUserById(userId);
  if (!user) return;
  await db.query(
    `INSERT INTO profile_opt_outs (github_id,last_login) VALUES ($1,$2)
     ON CONFLICT (github_id) DO UPDATE SET last_login=EXCLUDED.last_login,created_at=now()`,
    [user.github_id, user.login],
  );
  await db.query("DELETE FROM users WHERE id=$1", [userId]);
}

export async function deleteUser(userId: string): Promise<void> {
  await getPool().query("DELETE FROM users WHERE id=$1", [userId]);
}

export async function isOptedOut(login: string, githubId?: string): Promise<boolean> {
  const result = await getPool().query<{ opted_out: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM profile_opt_outs
       WHERE lower(last_login)=lower($1) OR ($2::bigint IS NOT NULL AND github_id=$2::bigint)
     ) opted_out`,
    [login, githubId ?? null],
  );
  return result.rows[0]?.opted_out ?? false;
}

export async function getUserById(userId: string): Promise<UserRow | null> {
  const result = await getPool().query<UserRow>("SELECT * FROM users WHERE id=$1", [userId]);
  return result.rows[0] ?? null;
}

export async function getUserByLogin(login: string): Promise<UserRow | null> {
  const direct = await getPool().query<UserRow>("SELECT * FROM users WHERE lower(login)=lower($1)", [login]);
  if (direct.rows[0]) return direct.rows[0];
  const alias = await getPool().query<UserRow>(
    `SELECT u.* FROM github_login_aliases a JOIN users u ON u.id=a.user_id WHERE lower(a.login)=lower($1)`,
    [login],
  );
  return alias.rows[0] ?? null;
}

export async function upsertRepository(repo: RepositoryIdentity): Promise<string> {
  const result = await getPool().query<{ id: string }>(
    `INSERT INTO repositories
      (github_id,github_node_id,owner_login,owner_github_id,owner_avatar_url,name,full_name,html_url,description,primary_language,stars,is_fork,is_archived,metadata_refreshed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
     ON CONFLICT (github_id) DO UPDATE SET
       github_node_id=EXCLUDED.github_node_id,owner_login=EXCLUDED.owner_login,owner_github_id=EXCLUDED.owner_github_id,
       owner_avatar_url=EXCLUDED.owner_avatar_url,name=EXCLUDED.name,full_name=EXCLUDED.full_name,html_url=EXCLUDED.html_url,
       description=EXCLUDED.description,primary_language=EXCLUDED.primary_language,stars=EXCLUDED.stars,is_fork=EXCLUDED.is_fork,
       is_archived=EXCLUDED.is_archived,metadata_refreshed_at=now(),updated_at=now()
     RETURNING id`,
    [repo.githubId, repo.nodeId, repo.ownerLogin, repo.ownerId, repo.ownerAvatarUrl, repo.name, repo.fullName, repo.htmlUrl, repo.description, repo.primaryLanguage, repo.stars, repo.isFork, repo.isArchived],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("Failed to upsert repository");
  return id;
}

export async function upsertPullRequest(userId: string, pr: PullRequestRecord): Promise<void> {
  const repositoryId = await upsertRepository(pr.repository);
  await getPool().query(
    `INSERT INTO pull_requests
      (node_id,database_id,user_id,repository_id,number,title,state,merged,additions,deletions,changed_files,url,created_at,updated_at,closed_at,merged_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (node_id) DO UPDATE SET
       database_id=EXCLUDED.database_id,repository_id=EXCLUDED.repository_id,number=EXCLUDED.number,title=EXCLUDED.title,
       state=EXCLUDED.state,merged=EXCLUDED.merged,additions=EXCLUDED.additions,deletions=EXCLUDED.deletions,
       changed_files=EXCLUDED.changed_files,url=EXCLUDED.url,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at,
       closed_at=EXCLUDED.closed_at,merged_at=EXCLUDED.merged_at`,
    [pr.nodeId, pr.databaseId, userId, repositoryId, pr.number, pr.title, pr.state, pr.merged, pr.additions, pr.deletions, pr.changedFiles, pr.url, pr.createdAt, pr.updatedAt, pr.closedAt, pr.mergedAt],
  );
}

export async function upsertIssue(userId: string, issue: IssueRecord): Promise<void> {
  const repositoryId = await upsertRepository(issue.repository);
  await getPool().query(
    `INSERT INTO issues (node_id,database_id,user_id,repository_id,number,title,state,url,created_at,updated_at,closed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (node_id) DO UPDATE SET
       database_id=EXCLUDED.database_id,repository_id=EXCLUDED.repository_id,number=EXCLUDED.number,title=EXCLUDED.title,
       state=EXCLUDED.state,url=EXCLUDED.url,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at,closed_at=EXCLUDED.closed_at`,
    [issue.nodeId, issue.databaseId, userId, repositoryId, issue.number, issue.title, issue.state, issue.url, issue.createdAt, issue.updatedAt, issue.closedAt],
  );
}

export async function upsertYearContribution(userId: string, record: YearContributionRecord): Promise<void> {
  await getPool().query(
    `INSERT INTO yearly_contributions
      (user_id,year,total_contributions,commits,issues,pull_requests,reviews,restricted_contributions,repository_data,refreshed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,now())
     ON CONFLICT (user_id,year) DO UPDATE SET
       total_contributions=EXCLUDED.total_contributions,commits=EXCLUDED.commits,issues=EXCLUDED.issues,pull_requests=EXCLUDED.pull_requests,
       reviews=EXCLUDED.reviews,restricted_contributions=EXCLUDED.restricted_contributions,repository_data=EXCLUDED.repository_data,refreshed_at=now()`,
    [userId, record.year, record.totalContributions, record.commits, record.issues, record.pullRequests, record.reviews, record.restrictedContributions, JSON.stringify(record.repositories)],
  );
}

export async function getProfileSettings(userId: string): Promise<ProfileSettings> {
  const result = await getPool().query<{ settings: Partial<ProfileSettings> }>("SELECT settings FROM profile_settings WHERE user_id=$1", [userId]);
  const raw = result.rows[0]?.settings ?? {};
  return { ...defaultProfileSettings, ...raw, visibleMetrics: { ...defaultProfileSettings.visibleMetrics, ...(raw.visibleMetrics ?? {}) } };
}

export async function saveProfileSettings(userId: string, settings: ProfileSettings): Promise<void> {
  await getPool().query(
    `INSERT INTO profile_settings (user_id,settings,updated_at) VALUES ($1,$2::jsonb,now())
     ON CONFLICT (user_id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=now()`,
    [userId, JSON.stringify(settings)],
  );
  await getPool().query("UPDATE users SET public_profile=$2,updated_at=now() WHERE id=$1", [userId, settings.publicProfile]);
}

export async function saveSnapshot(userId: string, snapshot: ProfileSnapshot): Promise<void> {
  await getPool().query(
    `INSERT INTO profile_snapshots (user_id,metrics_version,snapshot,calculated_at)
     VALUES ($1,$2,$3::jsonb,$4)
     ON CONFLICT (user_id) DO UPDATE SET metrics_version=EXCLUDED.metrics_version,snapshot=EXCLUDED.snapshot,calculated_at=EXCLUDED.calculated_at`,
    [userId, snapshot.metricsVersion, JSON.stringify(snapshot), snapshot.calculatedAt],
  );
}

export async function getSnapshot(userId: string): Promise<ProfileSnapshot | null> {
  const result = await getPool().query<{ snapshot: ProfileSnapshot }>("SELECT snapshot FROM profile_snapshots WHERE user_id=$1", [userId]);
  return result.rows[0]?.snapshot ?? null;
}

export async function deleteYearContributionsNotIn(userId: string, years: number[]): Promise<void> {
  if (years.length === 0) { await getPool().query("DELETE FROM yearly_contributions WHERE user_id=$1", [userId]); return; }
  await getPool().query("DELETE FROM yearly_contributions WHERE user_id=$1 AND NOT (year=ANY($2::int[]))", [userId, years]);
}

export async function listYearContributions(userId: string): Promise<YearContributionRecord[]> {
  const result = await getPool().query<{
    year: number; total_contributions: number; commits: number; issues: number; pull_requests: number; reviews: number;
    restricted_contributions: number; repository_data: YearContributionRecord["repositories"];
  }>("SELECT * FROM yearly_contributions WHERE user_id=$1 ORDER BY year", [userId]);
  return result.rows.map((row) => ({
    year: row.year, totalContributions: row.total_contributions, commits: row.commits, issues: row.issues,
    pullRequests: row.pull_requests, reviews: row.reviews, restrictedContributions: row.restricted_contributions,
    repositories: row.repository_data ?? [],
  }));
}

export async function rebuildRepositoryContributions(userId: string): Promise<void> {
  const db = getPool();
  await db.query("DELETE FROM repository_contributions WHERE user_id=$1", [userId]);
  await db.query(
    `INSERT INTO repository_contributions
      (user_id,repository_id,pull_requests,merged_pull_requests,open_pull_requests,closed_unmerged_pull_requests,issues,reviews,commit_days,additions,deletions,changed_files,first_activity_at,last_activity_at)
     SELECT $1,r.id,
       COALESCE(p.pull_requests,0),COALESCE(p.merged_pull_requests,0),COALESCE(p.open_pull_requests,0),COALESCE(p.closed_unmerged_pull_requests,0),
       COALESCE(i.issues,0),0,0,COALESCE(p.additions,0),COALESCE(p.deletions,0),COALESCE(p.changed_files,0),
       LEAST(p.first_activity_at,i.first_activity_at),GREATEST(p.last_activity_at,i.last_activity_at)
     FROM repositories r
     LEFT JOIN (
       SELECT repository_id,count(*)::int pull_requests,
        count(*) FILTER (WHERE merged)::int merged_pull_requests,
        count(*) FILTER (WHERE state='OPEN')::int open_pull_requests,
        count(*) FILTER (WHERE NOT merged AND state<>'OPEN')::int closed_unmerged_pull_requests,
        COALESCE(sum(additions),0)::bigint additions,COALESCE(sum(deletions),0)::bigint deletions,COALESCE(sum(changed_files),0)::bigint changed_files,
        min(created_at) first_activity_at,max(updated_at) last_activity_at
       FROM pull_requests WHERE user_id=$1 GROUP BY repository_id
     ) p ON p.repository_id=r.id
     LEFT JOIN (
       SELECT repository_id,count(*)::int issues,min(created_at) first_activity_at,max(updated_at) last_activity_at
       FROM issues WHERE user_id=$1 GROUP BY repository_id
     ) i ON i.repository_id=r.id
     WHERE p.repository_id IS NOT NULL OR i.repository_id IS NOT NULL`,
    [userId],
  );

  const years = await listYearContributions(userId);
  const combined = new Map<string, { githubId: string; commits: number; reviews: number; firstYear: number; lastYear: number }>();
  for (const year of years) {
    for (const item of year.repositories) {
      const current = combined.get(item.repository.githubId) ?? { githubId: item.repository.githubId, commits: 0, reviews: 0, firstYear: year.year, lastYear: year.year };
      current.commits += item.commits;
      current.reviews += item.reviews;
      current.firstYear = Math.min(current.firstYear, year.year);
      current.lastYear = Math.max(current.lastYear, year.year);
      combined.set(item.repository.githubId, current);
      await upsertRepository(item.repository);
    }
  }
  for (const item of combined.values()) {
    await db.query(
      `INSERT INTO repository_contributions (user_id,repository_id,commit_days,reviews)
       SELECT $1,id,$3,$4 FROM repositories WHERE github_id=$2
       ON CONFLICT (user_id,repository_id) DO UPDATE SET
         commit_days=EXCLUDED.commit_days,reviews=EXCLUDED.reviews,updated_at=now()`,
      [userId, item.githubId, item.commits, item.reviews],
    );
  }
}

export async function listRepositoryWork(userId: string): Promise<RepositoryWorkSummary[]> {
  const result = await getPool().query<{
    github_id: string; full_name: string; owner_login: string; owner_avatar_url: string | null; html_url: string; description: string | null;
    primary_language: string | null; stars: number; is_fork: boolean; pull_requests: number; merged_pull_requests: number; open_pull_requests: number;
    closed_unmerged_pull_requests: number; issues: number; reviews: number; commit_days: number; additions: string; deletions: string; changed_files: string;
    first_activity_at: Date | null; last_activity_at: Date | null;
  }>(
    `SELECT r.github_id,r.full_name,r.owner_login,r.owner_avatar_url,r.html_url,r.description,r.primary_language,r.stars,r.is_fork,
       c.pull_requests,c.merged_pull_requests,c.open_pull_requests,c.closed_unmerged_pull_requests,c.issues,c.reviews,c.commit_days,
       c.additions,c.deletions,c.changed_files,c.first_activity_at,c.last_activity_at
     FROM repository_contributions c JOIN repositories r ON r.id=c.repository_id
     WHERE c.user_id=$1 AND (c.pull_requests+c.issues+c.reviews+c.commit_days)>0`,
    [userId],
  );
  const user = await getUserById(userId);
  if (!user) return [];
  const years = await listYearContributions(userId);
  const activityYears = new Map<string, { first: number; last: number }>();
  for (const year of years) for (const item of year.repositories) {
    const current = activityYears.get(item.repository.githubId) ?? { first: year.year, last: year.year };
    current.first = Math.min(current.first, year.year); current.last = Math.max(current.last, year.year);
    activityYears.set(item.repository.githubId, current);
  }
  return result.rows.map((row) => {
    const activity = activityYears.get(row.github_id);
    return {
      repositoryId: row.github_id, fullName: row.full_name, ownerLogin: row.owner_login, ownerAvatarUrl: row.owner_avatar_url,
      htmlUrl: row.html_url, description: row.description, primaryLanguage: row.primary_language, stars: row.stars, isFork: row.is_fork,
      role: row.owner_login.toLowerCase() === user.login.toLowerCase() ? "owner" : "contributor",
      pullRequests: row.pull_requests, mergedPullRequests: row.merged_pull_requests, openPullRequests: row.open_pull_requests,
      closedUnmergedPullRequests: row.closed_unmerged_pull_requests, issues: row.issues, reviews: row.reviews, commits: row.commit_days,
      additions: Number(row.additions), deletions: Number(row.deletions), changedFiles: Number(row.changed_files),
      firstActivityAt: row.first_activity_at?.toISOString() ?? null, lastActivityAt: row.last_activity_at?.toISOString() ?? null,
      firstActivityYear: activity?.first ?? null, lastActivityYear: activity?.last ?? null,
    };
  });
}

export async function listRepositoriesForUser(userId: string): Promise<RepositoryIdentity[]> {
  const result = await getPool().query<{
    github_id: string; github_node_id: string | null; owner_login: string; owner_github_id: string | null; owner_avatar_url: string | null;
    name: string; full_name: string; html_url: string; description: string | null; primary_language: string | null; stars: number; is_fork: boolean; is_archived: boolean;
  }>(`SELECT DISTINCT r.github_id,r.github_node_id,r.owner_login,r.owner_github_id,r.owner_avatar_url,r.name,r.full_name,r.html_url,r.description,r.primary_language,r.stars,r.is_fork,r.is_archived
      FROM repositories r JOIN repository_contributions c ON c.repository_id=r.id WHERE c.user_id=$1`, [userId]);
  return result.rows.map((row) => ({
    githubId: row.github_id, nodeId: row.github_node_id, ownerLogin: row.owner_login, ownerId: row.owner_github_id, ownerAvatarUrl: row.owner_avatar_url,
    name: row.name, fullName: row.full_name, htmlUrl: row.html_url, description: row.description, primaryLanguage: row.primary_language,
    stars: row.stars, isFork: row.is_fork, isArchived: row.is_archived,
  }));
}

export async function removeUserRepositoryData(userId: string, githubRepositoryId: string): Promise<void> {
  const db = getPool();
  const repo = await db.query<{ id: string }>("SELECT id FROM repositories WHERE github_id=$1", [githubRepositoryId]);
  const repositoryId = repo.rows[0]?.id;
  if (!repositoryId) return;
  await db.query("DELETE FROM pull_requests WHERE user_id=$1 AND repository_id=$2", [userId, repositoryId]);
  await db.query("DELETE FROM issues WHERE user_id=$1 AND repository_id=$2", [userId, repositoryId]);
  await db.query("DELETE FROM repository_contributions WHERE user_id=$1 AND repository_id=$2", [userId, repositoryId]);
  const years = await db.query<{ year: number; repository_data: YearContributionRecord["repositories"] }>("SELECT year,repository_data FROM yearly_contributions WHERE user_id=$1", [userId]);
  for (const year of years.rows) {
    const filtered = (year.repository_data ?? []).filter((item) => item.repository.githubId !== githubRepositoryId);
    if (filtered.length !== (year.repository_data ?? []).length) {
      await db.query("UPDATE yearly_contributions SET repository_data=$3::jsonb,refreshed_at=now() WHERE user_id=$1 AND year=$2", [userId, year.year, JSON.stringify(filtered)]);
    }
  }
}

export async function getPrTotals(userId: string): Promise<{ total: number; merged: number; open: number; closedUnmerged: number; additions: number; deletions: number; changedFiles: number }> {
  const result = await getPool().query<{ total: number; merged: number; open: number; closed_unmerged: number; additions: string; deletions: string; changed_files: string }>(
    `SELECT count(*)::int total,count(*) FILTER (WHERE merged)::int merged,count(*) FILTER (WHERE state='OPEN')::int open,
      count(*) FILTER (WHERE NOT merged AND state<>'OPEN')::int closed_unmerged,COALESCE(sum(additions),0)::bigint additions,
      COALESCE(sum(deletions),0)::bigint deletions,COALESCE(sum(changed_files),0)::bigint changed_files FROM pull_requests WHERE user_id=$1`,
    [userId],
  );
  const row = result.rows[0];
  return { total: row?.total ?? 0, merged: row?.merged ?? 0, open: row?.open ?? 0, closedUnmerged: row?.closed_unmerged ?? 0, additions: Number(row?.additions ?? 0), deletions: Number(row?.deletions ?? 0), changedFiles: Number(row?.changed_files ?? 0) };
}

export async function getIssueTotal(userId: string): Promise<number> {
  const result = await getPool().query<{ total: number }>("SELECT count(*)::int total FROM issues WHERE user_id=$1", [userId]);
  return result.rows[0]?.total ?? 0;
}

export async function enqueueSync(userId: string, kind: SyncKind, runAfter = new Date()): Promise<void> {
  await getPool().query(
    `INSERT INTO sync_jobs (user_id,kind,status,run_after) VALUES ($1,$2,'pending',$3)
     ON CONFLICT DO NOTHING`,
    [userId, kind, runAfter],
  );
}

export interface ClaimedJob { id: string; userId: string; kind: SyncKind; attempts: number }

export async function claimSyncJob(): Promise<ClaimedJob | null> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string; user_id: string; kind: SyncKind; attempts: number }>(
      `SELECT id,user_id,kind,attempts FROM sync_jobs WHERE status='pending' AND run_after<=now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) { await client.query("COMMIT"); return null; }
    await client.query("UPDATE sync_jobs SET status='running',attempts=attempts+1,updated_at=now() WHERE id=$1", [row.id]);
    await client.query("COMMIT");
    return { id: row.id, userId: row.user_id, kind: row.kind, attempts: row.attempts + 1 };
  } catch (error) {
    await client.query("ROLLBACK"); throw error;
  } finally { client.release(); }
}

export async function completeSyncJob(id: string): Promise<void> {
  await getPool().query("UPDATE sync_jobs SET status='complete',updated_at=now() WHERE id=$1", [id]);
}

export async function failSyncJob(id: string, error: string, attempts: number): Promise<void> {
  if (attempts >= 5) {
    await getPool().query("UPDATE sync_jobs SET status='failed',last_error=$2,updated_at=now() WHERE id=$1", [id, error.slice(0, 2000)]);
    return;
  }
  const delayMinutes = Math.min(60, 2 ** attempts);
  await getPool().query("UPDATE sync_jobs SET status='pending',last_error=$2,run_after=now()+($3 || ' minutes')::interval,updated_at=now() WHERE id=$1", [id, error.slice(0, 2000), String(delayMinutes)]);
}

export async function createOrResumeSyncRun(userId: string, kind: SyncKind, initialState: object): Promise<{ id: string; state: Record<string, unknown> }> {
  if (kind === "backfill") {
    const previous = await getPool().query<{ id: string; state: Record<string, unknown> }>(
      `SELECT id,state FROM sync_runs WHERE user_id=$1 AND kind='backfill' AND status IN ('running','failed') ORDER BY started_at DESC LIMIT 1`, [userId],
    );
    if (previous.rows[0]) {
      await getPool().query("UPDATE sync_runs SET status='running',error_summary=NULL,updated_at=now() WHERE id=$1", [previous.rows[0].id]);
      return previous.rows[0];
    }
  }
  const result = await getPool().query<{ id: string; state: Record<string, unknown> }>(
    "INSERT INTO sync_runs (user_id,kind,status,state) VALUES ($1,$2,'running',$3::jsonb) RETURNING id,state", [userId, kind, JSON.stringify(initialState)],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Failed to create sync run");
  return row;
}

export async function updateSyncRunState(runId: string, state: object): Promise<void> {
  await getPool().query("UPDATE sync_runs SET state=$2::jsonb,status='running',updated_at=now() WHERE id=$1", [runId, JSON.stringify(state)]);
}
export async function finishSyncRun(runId: string): Promise<void> {
  await getPool().query("UPDATE sync_runs SET status='complete',completed_at=now(),updated_at=now() WHERE id=$1", [runId]);
}
export async function failSyncRun(runId: string, error: string): Promise<void> {
  await getPool().query("UPDATE sync_runs SET status='failed',error_summary=$2,updated_at=now() WHERE id=$1", [runId, error.slice(0, 2000)]);
}

export async function latestSyncStatus(userId: string): Promise<{ kind: string; status: string; started_at: Date; completed_at: Date | null; error_summary: string | null } | null> {
  const result = await getPool().query<{ kind: string; status: string; started_at: Date; completed_at: Date | null; error_summary: string | null }>(
    "SELECT kind,status,started_at,completed_at,error_summary FROM sync_runs WHERE user_id=$1 ORDER BY started_at DESC LIMIT 1", [userId],
  );
  return result.rows[0] ?? null;
}

export async function enqueueDueSyncs(syncHours: number, reconcileHours: number): Promise<void> {
  await getPool().query(
    `INSERT INTO sync_jobs (user_id,kind,status)
     SELECT u.id,'incremental','pending' FROM users u
     JOIN github_accounts a ON a.user_id=u.id AND a.disconnected_at IS NULL AND a.token_ciphertext IS NOT NULL
     LEFT JOIN profile_snapshots s ON s.user_id=u.id
     WHERE (s.calculated_at IS NULL OR s.calculated_at<now()-($1 || ' hours')::interval)
     ON CONFLICT DO NOTHING`, [String(syncHours)],
  );
  await getPool().query(
    `INSERT INTO sync_jobs (user_id,kind,status)
     SELECT u.id,'reconcile','pending' FROM users u
     JOIN github_accounts a ON a.user_id=u.id AND a.disconnected_at IS NULL AND a.token_ciphertext IS NOT NULL
     WHERE EXISTS (SELECT 1 FROM profile_snapshots s WHERE s.user_id=u.id)
       AND NOT EXISTS (SELECT 1 FROM sync_runs r WHERE r.user_id=u.id AND r.kind='reconcile' AND r.status='complete' AND r.completed_at>now()-($1 || ' hours')::interval)
     ON CONFLICT DO NOTHING`, [String(reconcileHours)],
  );
}

export async function getLastCompletedSyncAt(userId: string): Promise<Date | null> {
  const result = await getPool().query<{ completed_at: Date | null }>(
    "SELECT completed_at FROM sync_runs WHERE user_id=$1 AND status='complete' ORDER BY completed_at DESC NULLS LAST LIMIT 1", [userId],
  );
  return result.rows[0]?.completed_at ?? null;
}

export function parseBackfillState(state: Record<string, unknown>, years: number[]): BackfillState {
  const storedYears = Array.isArray(state.years) ? state.years.filter((x): x is number => typeof x === "number") : years;
  const nextYearIndex = typeof state.nextYearIndex === "number" ? state.nextYearIndex : 0;
  return { years: storedYears.length ? storedYears : years, nextYearIndex };
}
