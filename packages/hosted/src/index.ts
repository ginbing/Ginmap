import { githubPublicToken } from "@ginmap/config";
import {
  enqueueSync,
  getPool,
  getProfileSettings,
  getSnapshot,
  getUserByLogin,
  latestSyncStatus,
  upsertUser,
  type UserRow,
} from "@ginmap/db";
import { fetchPublicIdentity } from "@ginmap/github";
import type { ProfileSettings, ProfileSnapshot, RepositoryEvidence, RepositoryWorkSummary } from "@ginmap/model";

const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export interface HostedProfileState {
  user: UserRow;
  snapshot: ProfileSnapshot | null;
  settings: ProfileSettings;
  claimed: boolean;
  sync: Awaited<ReturnType<typeof latestSyncStatus>>;
}

export function validGitHubLogin(login: string): boolean {
  return LOGIN_RE.test(login);
}

export async function isClaimed(userId: string): Promise<boolean> {
  const result = await getPool().query<{ claimed: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM github_accounts
       WHERE user_id=$1 AND disconnected_at IS NULL AND token_ciphertext IS NOT NULL
     ) claimed`,
    [userId],
  );
  return result.rows[0]?.claimed ?? false;
}

export async function touchProfile(userId: string): Promise<void> {
  await getPool().query("UPDATE users SET last_viewed_at=now() WHERE id=$1", [userId]);
}

export async function ensureHostedProfile(login: string): Promise<HostedProfileState | null> {
  if (!validGitHubLogin(login)) return null;
  let user = await getUserByLogin(login);
  if (!user) {
    const identity = await fetchPublicIdentity(githubPublicToken(), login);
    if (!identity) return null;
    user = await upsertUser(identity);
    await enqueueSync(user.id, "backfill");
  }
  await touchProfile(user.id);
  const [snapshot, settings, claimed, sync] = await Promise.all([
    getSnapshot(user.id),
    getProfileSettings(user.id),
    isClaimed(user.id),
    latestSyncStatus(user.id),
  ]);
  if (!snapshot && (!sync || sync.status === "failed")) await enqueueSync(user.id, "backfill");
  return { user, snapshot, settings, claimed, sync };
}

export async function enqueueDuePublicSyncs(syncHours: number, reconcileHours: number): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO sync_jobs (user_id,kind,status)
     SELECT u.id,'incremental','pending' FROM users u
     LEFT JOIN profile_snapshots s ON s.user_id=u.id
     WHERE u.last_viewed_at > now()-interval '30 days'
       AND (s.calculated_at IS NULL OR s.calculated_at < now()-($1 || ' hours')::interval)
       AND NOT EXISTS (SELECT 1 FROM sync_jobs j WHERE j.user_id=u.id AND j.status IN ('pending','running'))`,
    [String(syncHours)],
  );
  await db.query(
    `INSERT INTO sync_jobs (user_id,kind,status)
     SELECT u.id,'reconcile','pending' FROM users u
     WHERE u.last_viewed_at > now()-interval '30 days'
       AND EXISTS (SELECT 1 FROM profile_snapshots s WHERE s.user_id=u.id)
       AND NOT EXISTS (
         SELECT 1 FROM sync_runs r WHERE r.user_id=u.id AND r.kind='reconcile' AND r.status='complete'
           AND r.completed_at > now()-($1 || ' hours')::interval
       )
       AND NOT EXISTS (SELECT 1 FROM sync_jobs j WHERE j.user_id=u.id AND j.status IN ('pending','running'))`,
    [String(reconcileHours)],
  );
}

export async function deleteExpiredUnclaimedProfiles(retentionDays: number): Promise<number> {
  const result = await getPool().query<{ id: string }>(
    `DELETE FROM users u
     WHERE u.last_viewed_at < now()-($1 || ' days')::interval
       AND NOT EXISTS (
         SELECT 1 FROM github_accounts a
         WHERE a.user_id=u.id AND a.disconnected_at IS NULL AND a.token_ciphertext IS NOT NULL
       )
     RETURNING id`,
    [String(retentionDays)],
  );
  return result.rowCount ?? 0;
}

export async function getRepositoryEvidence(userId: string, owner: string, repo: string): Promise<RepositoryEvidence | null> {
  const db = getPool();
  const work = await db.query<{
    github_id: string; full_name: string; owner_login: string; owner_avatar_url: string | null; html_url: string; stars: number;
    pull_requests: number; merged_pull_requests: number; open_pull_requests: number; closed_unmerged_pull_requests: number;
    issues: number; reviews: number; commit_days: number; additions: string; deletions: string; changed_files: string;
    first_activity_at: Date | null; last_activity_at: Date | null; repository_uuid: string; user_login: string;
  }>(
    `SELECT r.github_id,r.full_name,r.owner_login,r.owner_avatar_url,r.html_url,r.stars,r.id repository_uuid,u.login user_login,
       c.pull_requests,c.merged_pull_requests,c.open_pull_requests,c.closed_unmerged_pull_requests,c.issues,c.reviews,c.commit_days,
       c.additions,c.deletions,c.changed_files,c.first_activity_at,c.last_activity_at
     FROM repository_contributions c
     JOIN repositories r ON r.id=c.repository_id
     JOIN users u ON u.id=c.user_id
     WHERE c.user_id=$1 AND lower(r.owner_login)=lower($2) AND lower(r.name)=lower($3)`,
    [userId, owner, repo],
  );
  const row = work.rows[0];
  if (!row) return null;
  const repository: RepositoryWorkSummary = {
    repositoryId: row.github_id,
    fullName: row.full_name,
    ownerLogin: row.owner_login,
    ownerAvatarUrl: row.owner_avatar_url,
    htmlUrl: row.html_url,
    stars: row.stars,
    role: row.owner_login.toLowerCase() === row.user_login.toLowerCase() ? "owner" : "contributor",
    pullRequests: row.pull_requests,
    mergedPullRequests: row.merged_pull_requests,
    openPullRequests: row.open_pull_requests,
    closedUnmergedPullRequests: row.closed_unmerged_pull_requests,
    issues: row.issues,
    reviews: row.reviews,
    commitDays: row.commit_days,
    additions: Number(row.additions),
    deletions: Number(row.deletions),
    changedFiles: Number(row.changed_files),
    firstActivityAt: row.first_activity_at?.toISOString() ?? null,
    lastActivityAt: row.last_activity_at?.toISOString() ?? null,
  };
  const [prs, issues] = await Promise.all([
    db.query<{
      number: number; state: "OPEN" | "CLOSED" | "MERGED"; merged: boolean; additions: number; deletions: number; changed_files: number;
      created_at: Date; updated_at: Date; merged_at: Date | null; url: string;
    }>(`SELECT number,state,merged,additions,deletions,changed_files,created_at,updated_at,merged_at,url
        FROM pull_requests WHERE user_id=$1 AND repository_id=$2 ORDER BY created_at DESC`, [userId, row.repository_uuid]),
    db.query<{ number: number; state: "OPEN" | "CLOSED"; created_at: Date; updated_at: Date; url: string }>(
      `SELECT number,state,created_at,updated_at,url FROM issues
       WHERE user_id=$1 AND repository_id=$2 ORDER BY created_at DESC`, [userId, row.repository_uuid],
    ),
  ]);
  return {
    repository,
    pullRequests: prs.rows.map((pr) => ({
      number: pr.number, state: pr.state, merged: pr.merged, additions: pr.additions, deletions: pr.deletions,
      changedFiles: pr.changed_files, createdAt: pr.created_at.toISOString(), updatedAt: pr.updated_at.toISOString(),
      mergedAt: pr.merged_at?.toISOString() ?? null, url: pr.url,
    })),
    issues: issues.rows.map((issue) => ({
      number: issue.number, state: issue.state, createdAt: issue.created_at.toISOString(), updatedAt: issue.updated_at.toISOString(), url: issue.url,
    })),
  };
}
