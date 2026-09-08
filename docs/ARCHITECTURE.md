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
2. If Ginmap has never seen the login, the web process verifies the public GitHub identity with the hosted OAuth App credentials, creates the local profile, and queues a lifetime backfill.
3. The first HTML view renders a stable generation state while the worker builds the snapshot. JSON returns `202` with `Retry-After`; SVG returns a valid pending card.
4. Returning requests read the last-good snapshot from PostgreSQL. Public rendering never reconstructs a GitHub lifetime synchronously.
5. Active profiles receive incremental refreshes and slower reconciliation. Unclaimed profiles can expire after inactivity.

## Claim flow

Claiming is optional. A profile owner starts GitHub OAuth from `Claim this Ginmap`.

Ginmap requests no OAuth scopes, verifies that the authenticated GitHub numeric user ID matches the profile being claimed, encrypts the credential, and creates a session. The owner can then control presentation and indexing. Claiming does not create the public profile and does not grant permission to rewrite GitHub facts.

The worker prefers the owner's no-scope OAuth token for a claimed profile. Anonymous profiles use the hosted OAuth App's public-data credentials.

## Data flow

1. Read GitHub contribution years through GraphQL.
2. Process years oldest to newest and persist a checkpoint after each year.
3. Find authored PRs and issues through GitHub Search. Search windows above GitHub's 1,000-result retrieval ceiling are recursively split by time until each partition can be exhausted.
4. Store GitHub-counted contribution aggregates separately from exact authored PR/issue records.
5. Aggregate repository relationships and build one profile snapshot.
6. Split presentation into `Projects` and `External contributions` from repository ownership.
7. Serve HTML, SVG, and JSON from the same snapshot and settings.

## Sync strategy

`backfill` builds lifetime history. `incremental` updates recently changed work and current-year contribution data. `reconcile` refreshes recent years, open PRs, repository metadata, renames, deletions, and visibility changes.

Jobs use PostgreSQL and `FOR UPDATE SKIP LOCKED`. Failures retry with bounded exponential backoff. GitHub outages never replace a valid profile with an error if a last-good snapshot exists.

## Identity

GitHub numeric IDs are durable identity for people and repositories. Names are presentation fields. Login aliases preserve old profile links across GitHub username changes.

## Privacy and security boundary

The default product ingests public GitHub data only. It does not request repository write access or private-repository access. Unclaimed profiles are `noindex` by default. Claimed owners can explicitly enable indexing, hide repositories, disable their public profile, disconnect the claim, or delete stored Ginmap data.

OAuth credentials are encrypted at rest. Public APIs never expose credentials, sessions, internal database IDs, or repositories hidden by the owner.
