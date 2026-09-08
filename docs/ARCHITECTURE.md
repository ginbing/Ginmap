# Architecture

Ginmap is a hosted public product with three runtime components:

```text
browser / GitHub Camo / API client
              |
          Next.js web
              |
          PostgreSQL
              |
          sync worker
              |
          GitHub APIs
```

The public product is zero-config. Infrastructure stays behind the hosted service.

## Public flow

1. A reader opens `/<github-login>`, `/<github-login>.svg`, or `/<github-login>.json`.
2. Existing profiles are served from the last-good PostgreSQL snapshot.
3. For a new login, Ginmap applies global/per-requester admission control, checks its short-lived negative cache and owner opt-out tombstones, verifies the server public-data credential, then resolves the public GitHub identity.
4. Ginmap creates at most one active sync job for the profile. HTML shows a generation state, JSON returns `202` with `Retry-After`, and SVG returns a valid pending card.
5. Active profiles receive incremental refreshes and slower reconciliation. Unclaimed profiles can expire after inactivity.

## Claim flow

Claiming is optional. Ginmap requests no OAuth scopes and verifies the authenticated GitHub numeric user ID against the profile being claimed.

Ownership verification is persistent and separate from the OAuth connection. Disconnecting removes the credential and revokes sessions without erasing the owner's visibility/indexing choices. Deleting a claimed profile stores a minimal opt-out tombstone so anonymous lookup cannot immediately recreate it; a later verified claim can remove the opt-out.

## GitHub credential boundary

Anonymous ingestion uses a server-owned no-scope OAuth token. Ginmap verifies `X-OAuth-Scopes` is empty before using it. The operator should use a dedicated service account with no private repository or organization access.

Claimed profiles may use the owner's no-scope OAuth token while it remains connected. All GitHub API traffic passes through one serialized request queue. Rate-limit handling respects `Retry-After` and `X-RateLimit-Reset`, including GraphQL primary-limit failures that arrive with HTTP 200.

## Data flow

1. Read GitHub contribution years through GraphQL.
2. Process years oldest to newest and persist a checkpoint after each year.
3. Find authored PRs and issues through GitHub Search. Search windows above the 1,000-result retrieval ceiling are recursively split until each partition is exhaustible.
4. Store GitHub-counted contribution aggregates separately from exact authored PR/issue records, including PR/issue titles and repository context.
5. Aggregate repository relationships and build one profile snapshot.
6. `Projects` contains owned non-fork repositories with measurable work. `External contributions` contains work in repositories owned elsewhere. Personal forks are not presented as original projects.
7. Serve HTML, SVG, and JSON from the same snapshot and settings.

## Hidden work

Repository hiding is a public-data boundary, not a visual-only filter. Ginmap recomputes PR, issue, diff, and repository totals from visible repositories. GitHub account-wide contribution/commit/review totals and yearly history are withheld when any repository is hidden because they cannot always be subtracted reliably.

## Sync and identity

`backfill` builds lifetime history. `incremental` updates recently changed work and current-year data. `reconcile` refreshes recent years, open PRs, repository metadata, deletions, and visibility changes.

GitHub numeric IDs are durable identity for people and repositories. Public users are re-resolved by `GET /user/{account_id}` during synchronization, so username changes do not depend on the old login still resolving. Login aliases keep old Ginmap URLs redirectable.

Jobs are PostgreSQL-backed and claimed with `FOR UPDATE SKIP LOCKED`. A partial unique index permits only one pending/running job per profile. Failures retry with bounded backoff. GitHub outages do not replace a valid last-good snapshot.

## Database changes

SQL migrations are applied in filename order, transactionally, and recorded in `schema_migrations`. An applied migration is not rerun on later deploys.
