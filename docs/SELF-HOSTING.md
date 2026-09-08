# Self-hosting

Self-hosting is optional. Most people should use the hosted Ginmap service without installing anything.

An operator running a Ginmap instance needs Node.js 22+, PostgreSQL 16+, a server-side GitHub token for public ingestion, and a GitHub OAuth App for optional profile claiming.

## Environment

Copy `.env.example` and set:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `GITHUB_PUBLIC_TOKEN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SESSION_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- optional sync, reconciliation, and unclaimed-retention settings

`GITHUB_PUBLIC_TOKEN` belongs to the Ginmap operator. Ordinary visitors and profile owners never provide a PAT to use Ginmap. The token must be able to read the public GitHub data used by the GraphQL and REST ingestion paths.

Use long, independent random values for the two local secrets.

The GitHub OAuth callback for profile claiming is:

```text
<NEXT_PUBLIC_APP_URL>/api/auth/github/callback
```

Do not configure private-repository or repository-write OAuth scopes. Claiming uses a no-scope OAuth authorization.

## Docker Compose

```bash
docker compose up -d db
npm install
npm run db:migrate
npm run build
docker compose up -d web worker
```

For a production deployment, build the image first and run migrations as an explicit release step:

```bash
docker compose build
docker compose run --rm web npm run db:migrate
docker compose up -d
```

## Backups

PostgreSQL contains normalized public activity, profile settings, encrypted OAuth credentials for claimed profiles, cached snapshots, and sync state. Treat database backups as sensitive.

## Upgrades

Run all database migrations before starting a new application version. Public JSON carries a schema version and metric definitions carry a separate metric-version identifier.
