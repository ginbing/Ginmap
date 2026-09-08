CREATE TABLE IF NOT EXISTS profile_opt_outs (
  github_id bigint PRIMARY KEY,
  last_login text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS profile_opt_outs_login_idx ON profile_opt_outs(lower(last_login));

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
