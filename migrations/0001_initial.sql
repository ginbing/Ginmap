CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id bigint NOT NULL UNIQUE,
  github_node_id text,
  login text NOT NULL UNIQUE,
  avatar_url text NOT NULL,
  profile_url text NOT NULL,
  github_created_at timestamptz NOT NULL,
  public_profile boolean NOT NULL DEFAULT true,
  owner_verified_at timestamptz,
  opted_out_at timestamptz,
  session_version integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_last_viewed_idx ON users(last_viewed_at);

CREATE TABLE IF NOT EXISTS github_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text NOT NULL DEFAULT '',
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz
);

CREATE TABLE IF NOT EXISTS github_login_aliases (
  github_id bigint NOT NULL,
  login text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_opt_outs (
  github_id bigint PRIMARY KEY,
  last_login text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_opt_outs_login_idx ON profile_opt_outs(lower(last_login));

CREATE TABLE IF NOT EXISTS repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id bigint NOT NULL UNIQUE,
  github_node_id text,
  owner_login text NOT NULL,
  owner_github_id bigint,
  owner_avatar_url text,
  name text NOT NULL,
  full_name text NOT NULL,
  html_url text NOT NULL,
  description text,
  primary_language text,
  stars integer NOT NULL DEFAULT 0,
  is_fork boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  metadata_refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS repositories_full_name_idx ON repositories(full_name);

CREATE TABLE IF NOT EXISTS pull_requests (
  node_id text PRIMARY KEY,
  database_id bigint,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text NOT NULL DEFAULT '',
  state text NOT NULL,
  merged boolean NOT NULL DEFAULT false,
  additions integer NOT NULL DEFAULT 0,
  deletions integer NOT NULL DEFAULT 0,
  changed_files integer NOT NULL DEFAULT 0,
  url text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  closed_at timestamptz,
  merged_at timestamptz,
  UNIQUE(user_id, repository_id, number)
);
CREATE INDEX IF NOT EXISTS pull_requests_user_idx ON pull_requests(user_id);
CREATE INDEX IF NOT EXISTS pull_requests_repo_idx ON pull_requests(user_id, repository_id);
CREATE INDEX IF NOT EXISTS pull_requests_open_idx ON pull_requests(user_id, merged, state);

CREATE TABLE IF NOT EXISTS issues (
  node_id text PRIMARY KEY,
  database_id bigint,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text NOT NULL DEFAULT '',
  state text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  closed_at timestamptz,
  UNIQUE(user_id, repository_id, number)
);
CREATE INDEX IF NOT EXISTS issues_user_idx ON issues(user_id);
CREATE INDEX IF NOT EXISTS issues_repo_idx ON issues(user_id, repository_id);

CREATE TABLE IF NOT EXISTS yearly_contributions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  total_contributions integer NOT NULL DEFAULT 0,
  commits integer NOT NULL DEFAULT 0,
  issues integer NOT NULL DEFAULT 0,
  pull_requests integer NOT NULL DEFAULT 0,
  reviews integer NOT NULL DEFAULT 0,
  restricted_contributions integer NOT NULL DEFAULT 0,
  repository_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, year)
);

CREATE TABLE IF NOT EXISTS repository_contributions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  pull_requests integer NOT NULL DEFAULT 0,
  merged_pull_requests integer NOT NULL DEFAULT 0,
  open_pull_requests integer NOT NULL DEFAULT 0,
  closed_unmerged_pull_requests integer NOT NULL DEFAULT 0,
  issues integer NOT NULL DEFAULT 0,
  reviews integer NOT NULL DEFAULT 0,
  commit_days integer NOT NULL DEFAULT 0,
  additions bigint NOT NULL DEFAULT 0,
  deletions bigint NOT NULL DEFAULT 0,
  changed_files bigint NOT NULL DEFAULT 0,
  first_activity_at timestamptz,
  last_activity_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, repository_id)
);

CREATE TABLE IF NOT EXISTS profile_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_snapshots (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  metrics_version text NOT NULL,
  snapshot jsonb NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_runs_user_idx ON sync_runs(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  run_after timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_jobs_claim_idx ON sync_jobs(status, run_after, id);
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
