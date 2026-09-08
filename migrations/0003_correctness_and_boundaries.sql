ALTER TABLE users
  ADD COLUMN IF NOT EXISTS owner_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS primary_language text;

ALTER TABLE pull_requests
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='repository_contributions' AND column_name='commit_days'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='repository_contributions' AND column_name='commits'
  ) THEN
    ALTER TABLE repository_contributions RENAME COLUMN commit_days TO commits;
  END IF;
END $$;

-- Keep one active sync job per profile. Older duplicate jobs are not useful after
-- a newer job has been queued and make anonymous lookup amplification possible.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY id DESC) AS rn
  FROM sync_jobs
  WHERE status IN ('pending','running')
)
UPDATE sync_jobs
SET status='failed', last_error='Superseded by a newer active sync job', updated_at=now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS sync_jobs_one_active_per_user_idx
  ON sync_jobs(user_id)
  WHERE status IN ('pending','running');

CREATE TABLE IF NOT EXISTS github_negative_lookups (
  login text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS github_negative_lookups_expiry_idx ON github_negative_lookups(expires_at);

CREATE TABLE IF NOT EXISTS public_lookup_buckets (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY(bucket_key, window_start)
);
CREATE INDEX IF NOT EXISTS public_lookup_buckets_window_idx ON public_lookup_buckets(window_start);
