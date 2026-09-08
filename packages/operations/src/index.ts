import { getPool, type UserRow } from "@ginmap/db";
import type { SyncKind } from "@ginmap/model";

export async function getCurrentUserByLogin(login: string): Promise<UserRow | null> {
  const result = await getPool().query<UserRow>("SELECT * FROM users WHERE lower(login)=lower($1)", [login]);
  return result.rows[0] ?? null;
}

export async function getAliasUserByLogin(login: string): Promise<UserRow | null> {
  const result = await getPool().query<UserRow>(
    `SELECT u.* FROM github_login_aliases a
     JOIN users u ON u.id=a.user_id
     WHERE lower(a.login)=lower($1)`,
    [login],
  );
  return result.rows[0] ?? null;
}

export async function isGithubIdOptedOut(githubId: string): Promise<boolean> {
  const result = await getPool().query<{ opted_out: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM profile_opt_outs WHERE github_id=$1::bigint) opted_out",
    [githubId],
  );
  return result.rows[0]?.opted_out ?? false;
}

export interface RecoverableJob {
  id: string;
  userId: string;
  kind: SyncKind;
  attempts: number;
}

export async function claimRecoverableSyncJob(leaseMinutes = 5): Promise<RecoverableJob | null> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string; user_id: string; kind: SyncKind; attempts: number }>(
      `SELECT id,user_id,kind,attempts
       FROM sync_jobs
       WHERE (status='pending' AND run_after<=now())
          OR (status='running' AND updated_at<now()-($1 || ' minutes')::interval)
       ORDER BY CASE WHEN status='running' THEN 0 ELSE 1 END, id
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
      [String(leaseMinutes)],
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      "UPDATE sync_jobs SET status='running',attempts=attempts+1,updated_at=now() WHERE id=$1",
      [row.id],
    );
    await client.query("COMMIT");
    return { id: row.id, userId: row.user_id, kind: row.kind, attempts: row.attempts + 1 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function heartbeatSyncJob(jobId: string): Promise<void> {
  await getPool().query("UPDATE sync_jobs SET updated_at=now() WHERE id=$1 AND status='running'", [jobId]);
}

export async function getIncrementalWatermark(userId: string): Promise<Date | null> {
  const incremental = await getPool().query<{ completed_at: Date | null }>(
    `SELECT completed_at FROM sync_runs
     WHERE user_id=$1 AND kind='incremental' AND status='complete'
     ORDER BY completed_at DESC NULLS LAST LIMIT 1`,
    [userId],
  );
  if (incremental.rows[0]?.completed_at) return incremental.rows[0].completed_at;

  const backfill = await getPool().query<{ completed_at: Date | null }>(
    `SELECT completed_at FROM sync_runs
     WHERE user_id=$1 AND kind='backfill' AND status='complete'
     ORDER BY completed_at DESC NULLS LAST LIMIT 1`,
    [userId],
  );
  return backfill.rows[0]?.completed_at ?? null;
}
