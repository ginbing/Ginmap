# Self-hosting

Ginmap requires Node.js 22+, PostgreSQL 16+, and a GitHub OAuth App.

## Environment

Copy `.env.example` and set:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SESSION_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- optional sync/reconciliation intervals

Use long, independent random values for the two secrets.

The GitHub OAuth callback is:

```text
<NEXT_PUBLIC_APP_URL>/api/auth/github/callback
```

Do not configure private-repository or repository-write OAuth scopes. Ginmap v1 does not need them.

## Docker Compose

```bash
docker compose up -d db
npm install
npm run db:migrate
npm run build
docker compose up -d web worker
```

For a single-command production deployment, build the image first and run migrations as an explicit release step:

```bash
docker compose build
docker compose run --rm web npm run db:migrate
docker compose up -d
```

## Backups

PostgreSQL contains the normalized public activity model, user display settings, encrypted OAuth tokens, and cached snapshots. Back up the database like any other application database. Treat database backups as secrets because they contain encrypted access tokens.

## Upgrades

Run database migrations before starting a new application version. The public API is versioned under `/api/v1` and metric definitions carry a separate metric-version identifier.
