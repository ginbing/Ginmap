import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { completeSyncJob, getPool } from "@ginmap/db";
import { claimRecoverableSyncJob, getIncrementalWatermark, heartbeatSyncJob } from "@ginmap/operations";

const databaseAvailable = Boolean(process.env.DATABASE_URL);
const createdUsers: string[] = [];

async function createUser(): Promise<string> {
  const id = randomUUID();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  await getPool().query(
    `INSERT INTO users (id,github_id,login,avatar_url,profile_url,github_created_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, suffix, `ginmap-test-${suffix}`, "https://example.invalid/avatar", "https://example.invalid/profile", new Date("2020-01-01T00:00:00Z")],
  );
  createdUsers.push(id);
  return id;
}

afterEach(async () => {
  for (const id of createdUsers.splice(0)) await getPool().query("DELETE FROM users WHERE id=$1", [id]);
});

describe.skipIf(!databaseAvailable)("operational database boundaries", () => {
  it("reclaims an abandoned running job and keeps its lease alive", async () => {
    const userId = await createUser();
    const inserted = await getPool().query<{ id: string }>(
      `INSERT INTO sync_jobs (user_id,kind,status,updated_at)
       VALUES ($1,'backfill','running',now()-interval '10 minutes') RETURNING id`,
      [userId],
    );
    const jobId = inserted.rows[0]!.id;

    const claimed = await claimRecoverableSyncJob(5);
    expect(claimed?.id).toBe(jobId);
    expect(claimed?.attempts).toBe(1);

    const before = await getPool().query<{ updated_at: Date }>("SELECT updated_at FROM sync_jobs WHERE id=$1", [jobId]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await heartbeatSyncJob(jobId);
    const after = await getPool().query<{ updated_at: Date }>("SELECT updated_at FROM sync_jobs WHERE id=$1", [jobId]);
    expect(after.rows[0]!.updated_at.getTime()).toBeGreaterThanOrEqual(before.rows[0]!.updated_at.getTime());

    await completeSyncJob(jobId);
  });

  it("does not let reconcile advance the incremental watermark", async () => {
    const userId = await createUser();
    const backfillAt = new Date("2026-09-08T10:00:00Z");
    const reconcileAt = new Date("2026-09-08T11:00:00Z");
    await getPool().query(
      `INSERT INTO sync_runs (user_id,kind,status,completed_at,state)
       VALUES ($1,'backfill','complete',$2,'{}'::jsonb),($1,'reconcile','complete',$3,'{}'::jsonb)`,
      [userId, backfillAt, reconcileAt],
    );
    expect((await getIncrementalWatermark(userId))?.toISOString()).toBe(backfillAt.toISOString());

    const incrementalAt = new Date("2026-09-08T12:00:00Z");
    await getPool().query(
      `INSERT INTO sync_runs (user_id,kind,status,completed_at,state)
       VALUES ($1,'incremental','complete',$2,'{}'::jsonb)`,
      [userId, incrementalAt],
    );
    expect((await getIncrementalWatermark(userId))?.toISOString()).toBe(incrementalAt.toISOString());
  });
});
