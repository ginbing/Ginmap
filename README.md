# Ginmap

**The missing summary layer for GitHub profiles.**

GitHub keeps an excellent record of work, but profiles make people reconstruct that record from a contribution graph, repository pages, and a chronological activity feed. Ginmap turns public GitHub history into a living summary of what a person has actually done and where they did it.

Ginmap shows lifetime pull requests, merged work, issues, reviews, repositories worked in, GitHub-counted contributions, and code changed through authored pull requests. Repository relationships are the main object, not vanity scores.

## What Ginmap provides

- a public, readable work profile;
- a repository work map built from public GitHub activity;
- lifetime and yearly contribution summaries;
- authored PR and issue history with merged/open/closed totals;
- PR additions, deletions, and changed-file totals with explicit definitions;
- a stable light/dark SVG card for GitHub READMEs;
- a versioned JSON API for agents and other tools;
- a hosted dashboard to hide noise, pin representative repositories, and manage the embed;
- resumable lifetime backfill and incremental sync;
- Docker-based self-hosting.

Ginmap never needs repository write access and v1 does not request private-repository access.

## Quick start

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run db:migrate
npm run dev
```

Run the worker in a second terminal:

```bash
npm run worker
```

Create a GitHub OAuth App with callback URL:

```text
http://localhost:3000/api/auth/github/callback
```

Then set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env`.

## Architecture

Ginmap is intentionally small: a Next.js web application, a background sync worker, and PostgreSQL. README card requests are rendered from stored snapshots and never call GitHub synchronously.

See [Architecture](docs/ARCHITECTURE.md), [Metrics](docs/METRICS.md), [Privacy](PRIVACY.md), [Security](SECURITY.md), and [Self-hosting](docs/SELF-HOSTING.md).

## License

Ginmap is licensed under **GNU Affero General Public License v3.0 only**. See [LICENSE](LICENSE).
