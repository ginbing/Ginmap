# Self-hosting

Self-hosting is optional. Most people should use the hosted Ginmap service without installing anything.

An operator needs Node.js 22+, PostgreSQL 16+, a dedicated GitHub account for public ingestion, and a GitHub OAuth App for optional profile claiming.

## Environment

Copy `.env.example` and set:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `GITHUB_PUBLIC_TOKEN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SESSION_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- optional sync/reconciliation, retention, and anonymous-admission settings

`GITHUB_PUBLIC_TOKEN` is an operator secret. Create a classic OAuth access token for a dedicated service account with **no OAuth scopes**. Ginmap checks GitHub's `X-OAuth-Scopes` response header at runtime and refuses a token with non-empty scopes. The service account should not be a collaborator on private repositories or belong to private organizations. Do not use a broadly scoped PAT.

Ordinary visitors and profile owners never provide a PAT to use Ginmap.

Use long, independent random values for `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY`. Configure `NEXT_PUBLIC_APP_URL` to the exact public origin; state-changing requests use it for same-origin validation.

The GitHub OAuth callback for profile claiming is:

```text
<NEXT_PUBLIC_APP_URL>/api/auth/github/callback
```

Claiming requests no OAuth scopes.

## Anonymous generation limits

`ANONYMOUS_PROFILES_PER_MINUTE` bounds new uncached profiles across the instance. `ANONYMOUS_PROFILES_PER_IP_PER_HOUR` adds a per-requester bound. Ginmap derives the requester from reverse-proxy IP headers, so deploy it behind a controlled proxy that overwrites `X-Forwarded-For` or `X-Real-IP`. The global limit remains the safety boundary even when client IP information is unavailable.

## Docker Compose

```bash
docker compose up -d db
npm ci
npm run db:migrate
npm run build
docker compose up -d web worker
```

For production, build the image first and run migrations as an explicit release step:

```bash
docker compose build
docker compose run --rm web npm run db:migrate
docker compose up -d
```

## Backups

PostgreSQL contains normalized public activity, owner settings, encrypted OAuth credentials, cached snapshots, opt-out tombstones, and sync state. Treat database backups as sensitive.

## Upgrades

Run database migrations before starting a new application version. Migrations are recorded in `schema_migrations` and are not rerun after successful application. Public JSON carries a schema version and metric definitions carry a separate metric-version identifier.
