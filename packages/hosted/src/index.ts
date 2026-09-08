import { anonymousProfilesPerIpPerHour, anonymousProfilesPerMinute, githubPublicToken } from "@ginmap/config";
import {
  enqueueSync,
  getPool,
  getProfileSettings,
  getSnapshot,
  getUserByLogin,
  isOptedOut,
  latestSyncStatus,
  listRepositoryWork,
  upsertUser,
  type UserRow,
} from "@ginmap/db";
import { fetchPublicIdentity, verifyPublicCredential } from "@ginmap/github";
import type { ProfileSettings, ProfileSnapshot, RepositoryEvidence } from "@ginmap/model";

const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
let publicCredentialReady: Promise<void> | null = null;

export interface HostedProfileState {
  user: UserRow;
  snapshot: ProfileSnapshot | null;
  settings: ProfileSettings;
  claimed: boolean;
  sync: Awaited<ReturnType<typeof latestSyncStatus>>;
}

export function validGitHubLogin(login: string): boolean { return LOGIN_RE.test(login); }

async function ensurePublicCredential(): Promise<string> {
  const token = githubPublicToken();
  publicCredentialReady ??= verifyPublicCredential(token);
  await publicCredentialReady;
  return token;
}

export async function isClaimed(userId: string): Promise<boolean> {
  const result = await getPool().query<{ claimed: boolean }>("SELECT owner_verified_at IS NOT NULL claimed FROM users WHERE id=$1", [userId]);
  return result.rows[0]?.claimed ?? false;
}

export async function touchProfile(userId: string): Promise<void> {
  await getPool().query("UPDATE users SET last_viewed_at=now() WHERE id=$1", [userId]);
}

async function negativeLookup(login: string): Promise<boolean> {
  const result = await getPool().query<{ hit: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM github_negative_lookups WHERE lower(login)=lower($1) AND expires_at>now()) hit",
    [login],
  );
  return result.rows[0]?.hit ?? false;
}

async function rememberNegativeLookup(login: string): Promise<void> {
  await getPool().query(
    `INSERT INTO github_negative_lookups (login,expires_at) VALUES ($1,now()+interval '15 minutes')
     ON CONFLICT (login) DO UPDATE SET expires_at=EXCLUDED.expires_at`,
    [login.toLowerCase()],
  );
}

async function consumeBucket(key: string, period: "minute" | "hour", limit: number): Promise<boolean> {
  const result = await getPool().query<{ request_count: number }>(
    `INSERT INTO public_lookup_buckets (bucket_key,window_start,request_count)
     VALUES ($1,date_trunc($2,now()),1)
     ON CONFLICT (bucket_key,window_start) DO UPDATE SET request_count=public_lookup_buckets.request_count+1
     RETURNING request_count`,
    [key, period],
  );
  return (result.rows[0]?.request_count ?? limit + 1) <= limit;
}

async function admitAnonymousProfile(requesterKey: string): Promise<boolean> {
  const globalOk = await consumeBucket("global:new-profile", "minute", anonymousProfilesPerMinute());
  if (!globalOk) return false;
  return consumeBucket(`ip:${requesterKey || "unknown"}`, "hour", anonymousProfilesPerIpPerHour());
}

export class AnonymousProfileRateLimitError extends Error {
  constructor() { super("Anonymous profile generation is temporarily rate limited"); }
}

export async function ensureHostedProfile(login: string, requesterKey = "unknown"): Promise<HostedProfileState | null> {
  if (!validGitHubLogin(login)) return null;
  let user = await getUserByLogin(login);
  if (user?.opted_out_at) return null;
  if (!user) {
    if (await isOptedOut(login)) return null;
    if (await negativeLookup(login)) return null;
    if (!await admitAnonymousProfile(requesterKey)) throw new AnonymousProfileRateLimitError();
    const token = await ensurePublicCredential();
    const identity = await fetchPublicIdentity(token, login);
    if (!identity) { await rememberNegativeLookup(login); return null; }
    if (await isOptedOut(login, identity.githubId)) return null;
    user = await upsertUser(identity);
    await enqueueSync(user.id, "backfill");
  }
  await touchProfile(user.id);
  const [snapshot, settings, claimed, sync] = await Promise.all([
    getSnapshot(user.id), getProfileSettings(user.id), isClaimed(user.id), latestSyncStatus(user.id),
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
     WHERE u.opted_out_at IS NULL AND u.last_viewed_at>now()-interval '30 days'
       AND (s.calculated_at IS NULL OR s.calculated_at<now()-($1 || ' hours')::interval)
     ON CONFLICT DO NOTHING`,
    [String(syncHours)],
  );
  await db.query(
    `INSERT INTO sync_jobs (user_id,kind,status)
     SELECT u.id,'reconcile','pending' FROM users u
     WHERE u.opted_out_at IS NULL AND u.last_viewed_at>now()-interval '30 days'
       AND EXISTS (SELECT 1 FROM profile_snapshots s WHERE s.user_id=u.id)
       AND NOT EXISTS (
         SELECT 1 FROM sync_runs r WHERE r.user_id=u.id AND r.kind='reconcile' AND r.status='complete'
           AND r.completed_at>now()-($1 || ' hours')::interval
       )
     ON CONFLICT DO NOTHING`,
    [String(reconcileHours)],
  );
}

export async function deleteExpiredUnclaimedProfiles(retentionDays: number): Promise<number> {
  const result = await getPool().query<{ id: string }>(
    `DELETE FROM users u
     WHERE u.owner_verified_at IS NULL
       AND u.last_viewed_at<now()-($1 || ' days')::interval
     RETURNING id`,
    [String(retentionDays)],
  );
  await getPool().query("DELETE FROM github_negative_lookups WHERE expires_at<now()");
  await getPool().query("DELETE FROM public_lookup_buckets WHERE window_start<now()-interval '2 hours'");
  return result.rowCount ?? 0;
}

export async function getRepositoryEvidence(userId: string, owner: string, repo: string): Promise<RepositoryEvidence | null> {
  const repositories = await listRepositoryWork(userId);
  const repository = repositories.find((item) => item.fullName.toLowerCase() === `${owner}/${repo}`.toLowerCase());
  if (!repository) return null;
  const db = getPool();
  const row = await db.query<{ id: string }>("SELECT id FROM repositories WHERE github_id=$1", [repository.repositoryId]);
  const repositoryUuid = row.rows[0]?.id;
  if (!repositoryUuid) return null;
  const [prs, issues] = await Promise.all([
    db.query<{
      number: number; title: string; state: "OPEN" | "CLOSED" | "MERGED"; merged: boolean; additions: number; deletions: number; changed_files: number;
      created_at: Date; updated_at: Date; merged_at: Date | null; url: string;
    }>(`SELECT number,title,state,merged,additions,deletions,changed_files,created_at,updated_at,merged_at,url
        FROM pull_requests WHERE user_id=$1 AND repository_id=$2 ORDER BY created_at DESC`, [userId, repositoryUuid]),
    db.query<{ number: number; title: string; state: "OPEN" | "CLOSED"; created_at: Date; updated_at: Date; url: string }>(
      `SELECT number,title,state,created_at,updated_at,url FROM issues WHERE user_id=$1 AND repository_id=$2 ORDER BY created_at DESC`,
      [userId, repositoryUuid],
    ),
  ]);
  return {
    repository,
    pullRequests: prs.rows.map((pr) => ({
      number: pr.number, title: pr.title, state: pr.state, merged: pr.merged, additions: pr.additions, deletions: pr.deletions,
      changedFiles: pr.changed_files, createdAt: pr.created_at.toISOString(), updatedAt: pr.updated_at.toISOString(),
      mergedAt: pr.merged_at?.toISOString() ?? null, url: pr.url,
    })),
    issues: issues.rows.map((issue) => ({
      number: issue.number, title: issue.title, state: issue.state, createdAt: issue.created_at.toISOString(),
      updatedAt: issue.updated_at.toISOString(), url: issue.url,
    })),
  };
}
