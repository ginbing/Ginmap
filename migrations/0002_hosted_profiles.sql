ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS users_last_viewed_idx ON users(last_viewed_at);
